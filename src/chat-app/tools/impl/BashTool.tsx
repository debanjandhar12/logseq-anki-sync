import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    BashCommand,
    BashCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import type {z} from "zod";
import {createLogseqReversibleTransactionTrackerArtifact} from "../transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "../transaction/getLastLogseqReversibleTransactionTracker";

const bashToolParameters = BashCommandArgsSchema;

type BashToolArgs = z.infer<typeof bashToolParameters>;

type BashToolResult =
    | ChatToolSuccessResult<{stdout: string; stderr: string; exitCode: number}>
    | ChatToolErrorResult;

export class BashTool extends BaseChatToolWithDefaultUI<BashToolArgs, BashToolResult> {
    static readonly NAME = "bash";

    readonly name = BashTool.NAME;
    readonly description =
        "Run a bash command in an isolated virtual filesystem. " +
        "Python is available through Pyodide, for example: " +
        "`python -c 'print(1 + 1)'`, and shares the virtual filesystem. " +
        "Inside python, packages if used need to be installed with micropip on every tool call as no package cache is shared between tool calls. ";
    readonly parameters = bashToolParameters;

    async execute(
        {command, cwd}: BashToolArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<BashToolResult>> {
        const tracker = getLastLogseqReversibleTransactionTracker(context?.messages);
        try {
            tracker.addCommand(new BashCommand({command, cwd}));
            const result = (await tracker.execute({signal: context?.abortSignal})) as {
                stdout: string;
                stderr: string;
                exitCode: number;
            };
            return ChatToolResponse.success(
                result,
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (error) {
            return ChatToolResponse.error(
                `Failed to execute bash command: ${getErrorMessageFromErrObj(error)}`,
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        }
    }
}
