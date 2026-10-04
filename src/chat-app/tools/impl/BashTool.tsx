import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {VIR_ENV_USER_PATH} from "src/constants";
import {JustBashWrapper} from "src/core/just-bash-wrapper";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {ToolResultStore} from "src/core/stores/tool-results/ToolResultStore";
import {z} from "zod";

const bashToolParameters = z.object({
    command: z
        .string()
        .describe(
            "The bash command to execute in the sandbox. Logseq files are not available here."
        ),
    cwd: z
        .string()
        .optional()
        .describe(`Absolute working directory. Defaults to ${VIR_ENV_USER_PATH}.`)
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
        "Sandboxed Python is available through Pyodide, for example: " +
        "`python -c 'print(1 + 1)'`, and shares files under the sandbox user directory. " +
        "Install compatible pinned packages with micropip. " +
        `Prior tool results are read-only at ${VIR_ENV_USER_PATH}/${ToolResultStore.groupName}, ` +
        `and parsed PDF pages are read-only at ${VIR_ENV_USER_PATH}/${AnyDocParseResultStore.groupName}.`;
    readonly parameters = bashToolParameters;

    async execute(
        {command, cwd}: BashToolArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<BashToolResult>> {
        try {
            const bash = await JustBashWrapper.getInstance();
            const {stdout, stderr, exitCode} = await bash.exec(command, {
                cwd,
                signal: context?.abortSignal
            });
            if (!Number.isInteger(exitCode)) {
                throw new Error("Bash returned an invalid exit code");
            }
            return ChatToolResponse.success({stdout, stderr, exitCode});
        } catch (error) {
            return ChatToolResponse.error(
                `Failed to execute bash command: ${getErrorMessageFromErrObj(error)}`
            );
        }
    }
}
