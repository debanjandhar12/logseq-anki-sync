import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {VIR_ENV_USER_PATH} from "src/constants";
import {
    BashCommand,
    BashCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {ToolResultStore} from "src/core/stores/tool-results/ToolResultStore";
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
        "Run a bash command in an isolated virtual filesystem with no host access. " +
        "Sandboxed Python is available through Pyodide, for example: " +
        "`python -c 'print(1 + 1)'`, and shares files under the sandbox user directory. " +
        "Install compatible pinned packages with micropip. " +
        "Use import logseq_lib and await its methods with argument dictionaries to read or reversibly modify Logseq pages, blocks, skills, command files, and assets. " +
        `Prior tool results are read-only at ${VIR_ENV_USER_PATH}/${ToolResultStore.groupName}, ` +
        `and parsed PDF pages are read-only at ${VIR_ENV_USER_PATH}/${AnyDocParseResultStore.groupName}.`;
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
