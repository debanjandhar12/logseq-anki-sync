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

const LogseqClearTemporaryChangesArgsZodObj = z.object({});

type LogseqClearTemporaryChangesArgs = z.infer<typeof LogseqClearTemporaryChangesArgsZodObj>;

type LogseqClearTemporaryChangesResult =
    | ChatToolSuccessResult<{warning?: string}>
    | ChatToolErrorResult;

export class LogseqClearTemporaryChangesTool extends BaseChatToolWithDefaultUI<
    LogseqClearTemporaryChangesArgs,
    LogseqClearTemporaryChangesResult
> {
    static readonly NAME = "logseq_clear_temporary_changes";

    readonly name = LogseqClearTemporaryChangesTool.NAME;
    readonly description =
        "Discard temporary Logseq graph changes made by block/page editing tools.";
    readonly parameters = LogseqClearTemporaryChangesArgsZodObj;

    async execute(
        _args: LogseqClearTemporaryChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqClearTemporaryChangesResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            if (transactionTracker.hasAppliedGraphMutations()) {
                try {
                    await transactionTracker.revertAppliedCommands();
                } catch (revertError) {
                    const revertErrorMessage = getErrorMessageFromErrObj(revertError);
                    logger.error(
                        "Failed to revert temporary Logseq changes before discarding",
                        revertError
                    );
                    transactionTracker.clear();
                    try {
                        await logseq.UI.showMsg(
                            `Failed to revert temporary Logseq changes: ${revertErrorMessage}. Temporary change tracking was cleared.`,
                            "error"
                        );
                    } catch (notificationError) {
                        logger.error("Failed to show Logseq revert warning", notificationError);
                    }
                    return ChatToolResponse.success(
                        {
                            warning: `Failed to revert temporary Logseq changes: ${revertErrorMessage}. Temporary change tracking was cleared.`
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
                `Failed to discard temporary Logseq changes: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
