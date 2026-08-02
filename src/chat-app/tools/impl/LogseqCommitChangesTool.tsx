import {type ToolCallMessagePartComponent, useAuiState} from "@assistant-ui/react";
import {GitCommitIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {ToolFallback} from "src/chat-app/components/ToolFallback";
import {usePersistLogseqTrackerArtifact} from "src/chat-app/hooks/usePersistLogseqTrackerArtifact";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithCustomUI} from "src/chat-app/tools/base/BaseChatToolWithCustomUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    findLastLogseqReversibleTransactionTracker,
    getLastLogseqReversibleTransactionTracker
} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getTrackerArtifactFromError} from "src/chat-app/tools/transaction/getTrackerArtifactFromError";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    LogseqPageDataPrinter,
    type LogseqReversibleTransactionTracker
} from "src/core/logseq-reversible-transaction-tracker";
import {createLogger, LoggerCategory} from "src/logger";
import {Button} from "src/shadcn/radix-ui/button";
import {showAIChangesReviewModal} from "src/ui/launchers/showAIChangesReviewModal";
import {z} from "zod";

const logger = createLogger(LoggerCategory.CHAT_UI);

class DiffRevertFailedError extends Error {
    public constructor(public readonly cause: unknown) {
        super("Failed to revert while generating diff");
        this.name = "DiffRevertFailedError";
    }
}

const LogseqCommitChangesArgsZodObj = z.object({});

type LogseqCommitChangesArgs = z.infer<typeof LogseqCommitChangesArgsZodObj>;

type LogseqCommitChangesResult = ChatToolSuccessResult<{changes: string}> | ChatToolErrorResult;

export class LogseqCommitChangesTool extends BaseChatToolWithCustomUI<
    LogseqCommitChangesArgs,
    LogseqCommitChangesResult
> {
    static readonly NAME = "logseq_commit_changes";

    readonly name = LogseqCommitChangesTool.NAME;
    readonly type = "human";
    readonly description =
        "Ask the user to approve committing pending Logseq graph changes made by block/page editing tools.";
    readonly parameters = LogseqCommitChangesArgsZodObj;

    async executeApprove(
        _args: LogseqCommitChangesArgs = {},
        context?: ChatToolExecutionContext,
        preparedTracker?: LogseqReversibleTransactionTracker
    ): Promise<ChatToolResponse<LogseqCommitChangesResult>> {
        try {
            const transactionTracker =
                preparedTracker ?? getLastLogseqReversibleTransactionTracker(context?.messages);
            if (transactionTracker.getGraphMutationCommandCount() === 0) {
                return ChatToolResponse.success(
                    {changes: "No pending changes to commit."},
                    createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                );
            }

            await transactionTracker.execute({signal: context?.abortSignal});
            if (!transactionTracker.hasAppliedGraphMutations()) {
                transactionTracker.clear();
                return ChatToolResponse.success(
                    {changes: "No pending changes to commit."},
                    createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                );
            }
            transactionTracker.clear();

            return ChatToolResponse.success(
                {changes: "All pending Logseq changes commited successfully."},
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to commit Logseq changes: ${getErrorMessageFromErrObj(err)}`,
                getTrackerArtifactFromError(err)
            );
        }
    }

    private async prepareReview(
        transactionTracker: LogseqReversibleTransactionTracker
    ): Promise<{beforeChanges: string; afterChanges: string; hasGraphMutations: boolean}> {
        await transactionTracker.execute();
        if (!transactionTracker.hasAppliedGraphMutations()) {
            return {beforeChanges: "", afterChanges: "", hasGraphMutations: false};
        }
        const changedPages = transactionTracker.getChangedPages();
        let afterChanges = "";
        try {
            afterChanges = await LogseqPageDataPrinter.print(changedPages);
        } catch (error) {
            // Revert failure while generating diffs is handled by the caller; rethrow so the review
            // flow can clear the tracker and report a meaningful error to addResult.
            try {
                await transactionTracker.revertAppliedCommands();
            } catch (revertError) {
                throw new DiffRevertFailedError(revertError);
            }
            throw error;
        }
        try {
            await transactionTracker.revertAppliedCommands();
        } catch (revertError) {
            throw new DiffRevertFailedError(revertError);
        }
        const beforeChanges = await LogseqPageDataPrinter.print(changedPages);

        return {beforeChanges, afterChanges, hasGraphMutations: true};
    }

    async executeCancel(
        transactionTracker?: LogseqReversibleTransactionTracker
    ): Promise<ChatToolResponse<LogseqCommitChangesResult>> {
        return ChatToolResponse.error(
            "User cancelled the commit operation. Pending changes remain available.",
            transactionTracker
                ? createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                : undefined
        );
    }

    readonly render: ToolCallMessagePartComponent<
        LogseqCommitChangesArgs,
        LogseqCommitChangesResult
    > = (props) => {
        const {result, addResult, status} = props;
        const messages = useAuiState((state) => state.thread.messages);
        const [isReviewing, setIsReviewing] = useState(false);
        const noChangesResultAddedRef = useRef(false);
        const persistTrackerArtifact = usePersistLogseqTrackerArtifact();

        const isPending = result === undefined && status?.type !== "incomplete";
        const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
        const hasGraphMutations = (locatedTracker?.tracker.getGraphMutationCommandCount() ?? 0) > 0;

        useEffect(() => {
            if (!isPending || hasGraphMutations || noChangesResultAddedRef.current) return;

            noChangesResultAddedRef.current = true;
            void this.executeApprove({}, {messages}).then(addResult);
        }, [addResult, hasGraphMutations, isPending, messages]);

        const reviewAndApply = async () => {
            setIsReviewing(true);
            try {
                const located = findLastLogseqReversibleTransactionTracker(messages);
                const transactionTracker =
                    located?.tracker ?? getLastLogseqReversibleTransactionTracker(messages);
                let prepared: {
                    beforeChanges: string;
                    afterChanges: string;
                    hasGraphMutations: boolean;
                };
                try {
                    prepared = await this.prepareReview(transactionTracker);
                } catch (error) {
                    const isDiffRevertFailure = error instanceof DiffRevertFailedError;
                    const cause = isDiffRevertFailure ? error.cause : error;
                    const causeMessage = getErrorMessageFromErrObj(cause);
                    if (isDiffRevertFailure) {
                        transactionTracker.clear();
                        addResult(
                            ChatToolResponse.error(
                                `Failed to generate diff as revert failed due to: ${causeMessage}`,
                                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                            )
                        );
                        logger.error("Failed to generate diff as revert failed", cause);
                        if (located) {
                            await persistTrackerArtifact({...located, tracker: transactionTracker});
                        }
                        await logseq.UI.showMsg(
                            `Failed to generate diff as revert failed due to: ${causeMessage}`,
                            "error"
                        );
                        return;
                    }

                    if (located) {
                        await persistTrackerArtifact({...located, tracker: transactionTracker});
                    }
                    addResult(
                        ChatToolResponse.error(
                            getErrorMessageFromErrObj(error),
                            createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                        )
                    );
                    return;
                }

                if (located) {
                    await persistTrackerArtifact({...located, tracker: transactionTracker});
                }

                const {beforeChanges, afterChanges, hasGraphMutations} = prepared;
                if (!hasGraphMutations) {
                    addResult(await this.executeApprove({}, {messages}, transactionTracker));
                    return;
                }
                const isApproved = await showAIChangesReviewModal(beforeChanges, afterChanges);

                // Close button in showAIChangesReviewModal returns null
                if (isApproved === null) {
                    return;
                }

                if (!isApproved) {
                    addResult(await this.executeCancel(transactionTracker));
                } else {
                    addResult(await this.executeApprove({}, {messages}, transactionTracker));
                }
            } catch (error) {
                addResult(ChatToolResponse.error(getErrorMessageFromErrObj(error)));
            } finally {
                setIsReviewing(false);
            }
        };

        if (!isPending || !hasGraphMutations) {
            // Use the generic tool UI unless there are pending graph changes to review.
            return <ToolFallback {...props} />;
        }

        return (
            <div className="w-full rounded-lg border bg-background p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium">
                    <GitCommitIcon className="size-4" />
                    Commit Logseq changes
                </div>
                <div className="mb-3 text-muted-foreground">
                    AI Chat wants to make changes to your Logseq graph.
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={reviewAndApply} disabled={isReviewing}>
                        Review & Apply
                    </Button>
                </div>
            </div>
        );
    };
}
