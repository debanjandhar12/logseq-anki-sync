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

const LogseqClearUncommittedChangesArgsZodObj = z.object({});

type LogseqClearUncommittedChangesArgs = z.infer<typeof LogseqClearUncommittedChangesArgsZodObj>;

type LogseqClearUncommittedChangesResult =
    | ChatToolSuccessResult<{warning?: string}>
    | ChatToolErrorResult;

export class LogseqClearUncommittedChangesTool extends BaseChatToolWithDefaultUI<
    LogseqClearUncommittedChangesArgs,
    LogseqClearUncommittedChangesResult
> {
    static readonly NAME = "logseq_clear_uncommitted_changes";

    readonly name = LogseqClearUncommittedChangesTool.NAME;
    readonly description =
        "Revert applied uncommitted Logseq graph changes made by block/page editing tools and discard all uncommitted changes.";
    readonly parameters = LogseqClearUncommittedChangesArgsZodObj;

    async execute(
        _args: LogseqClearUncommittedChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqClearUncommittedChangesResult>> {
        try {
            const transactionTracker = getLastLogseqReversibleTransactionTracker(context?.messages);
            if (transactionTracker.hasAppliedGraphMutations()) {
                try {
                    await transactionTracker.revertAppliedCommands();
                } catch (revertError) {
                    const revertErrorMessage = getErrorMessageFromErrObj(revertError);
                    const warning = `Failed to revert applied uncommitted changes: ${revertErrorMessage}. Uncommitted changes were discarded.`;
                    logger.error(
                        "Failed to revert applied uncommitted changes before discarding",
                        revertError
                    );
                    transactionTracker.clear();
                    try {
                        await logseq.UI.showMsg(warning, "error");
                    } catch (notificationError) {
                        logger.error(
                            "Failed to show Logseq uncommitted-change revert warning",
                            notificationError
                        );
                    }
                    return ChatToolResponse.success(
                        {warning},
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
                `Failed to revert and discard uncommitted changes: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
