import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {JustBashWrapper} from "src/core/just-bash-wrapper";
import {z} from "zod";

const bashToolParameters = z.object({
    command: z.string().describe("The bash command to execute in the sandbox. Logseq files are not available here."),
    cwd: z
        .string()
        .optional()
        .describe("Absolute working directory. Defaults to /home/user.")
});

type BashToolArgs = z.infer<typeof bashToolParameters>;

type BashToolResult =
    | ChatToolSuccessResult<{stdout: string; stderr: string; exitCode: number}>
    | ChatToolErrorResult;

export class BashTool extends BaseChatToolWithDefaultUI<BashToolArgs, BashToolResult> {
    static readonly NAME = "bash";

    readonly name = BashTool.NAME;
    readonly description =
        "Run a bash command in an isolated virtual filesystem with no host access. " +
        "Python and JavaScript execution are disabled. Files under /home/user persist between " +
        "commands, and prior tool results are read-only at /home/user/tool-results.";
    readonly parameters = bashToolParameters;

    async execute(
        {command, cwd}: BashToolArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<BashToolResult>> {
        try {
            const {stdout, stderr, exitCode} = await JustBashWrapper.getInstance().exec(command, {
                cwd,
                signal: context?.abortSignal
            });
            return ChatToolResponse.success({stdout, stderr, exitCode});
        } catch (error) {
            return ChatToolResponse.error(
                `Failed to execute bash command: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }
}
