import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {createLogger, LoggerCategory} from "src/logger";
import {z} from "zod";

const logger = createLogger(LoggerCategory.CHAT_UI);

const LogseqClearChangesArgsZodObj = z.object({});

type LogseqClearChangesArgs = z.infer<typeof LogseqClearChangesArgsZodObj>;

type LogseqClearChangesResult = ChatToolSuccessResult<{warning?: string}> | ChatToolErrorResult;

export class LogseqClearChangesTool extends BaseChatToolWithDefaultUI<
    LogseqClearChangesArgs,
    LogseqClearChangesResult
> {
    static readonly NAME = "logseq_clear_changes";

    readonly name = LogseqClearChangesTool.NAME;
    readonly description = "Clear pending Logseq graph changes made by block/page editing tools.";
    readonly parameters = LogseqClearChangesArgsZodObj;

    async execute(
        _args: LogseqClearChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqClearChangesResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            if (transactionTracker.hasAppliedGraphMutations()) {
                try {
                    await transactionTracker.revertAppliedCommands();
                } catch (revertError) {
                    const revertErrorMessage = getErrorMessageFromErrObj(revertError);
                    logger.error(
                        "Failed to revert pending Logseq changes before clearing",
                        revertError
                    );
                    transactionTracker.clear();
                    try {
                        await logseq.UI.showMsg(
                            `Failed to revert pending Logseq changes: ${revertErrorMessage}. Staged changes were cleared.`,
                            "error"
                        );
                    } catch (notificationError) {
                        logger.error("Failed to show Logseq revert warning", notificationError);
                    }
                    return ChatToolResponse.success(
                        {
                            warning: `Failed to revert pending Logseq changes: ${revertErrorMessage}. Staged changes were cleared.`
                        },
                        createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                    );
                }
            }
            transactionTracker.clear();

            return ChatToolResponse.success(
                {},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to clear Logseq changes: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
