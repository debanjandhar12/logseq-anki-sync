import {type ToolCallMessagePartComponent, useAuiState} from "@assistant-ui/react";
import {GitCommitIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {ToolFallback} from "src/chat-app/components/ToolFallback";
import {usePersistLogseqTrackerArtifact} from "src/chat-app/hooks/usePersistLogseqTrackerArtifact";
import {useStopThread} from "src/chat-app/hooks/useStopThread";
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
    type LogseqPrintedPageChange,
    type LogseqPrintedPageSnapshot,
    type LogseqReversibleTransactionTracker
} from "src/core/logseq-reversible-transaction-tracker";
import {createLogger, LoggerCategory} from "src/logger";
import {Button} from "src/shadcn/radix-ui/button";
import {showAIChangesReviewModal} from "src/ui/launchers/showAIChangesReviewModal";
import {z} from "zod";

const logger = createLogger(LoggerCategory.CHAT_UI);
const COMMIT_LATER_MESSAGE =
    "Changes not committed. User will commit later. Do not call this tool immediately again without feedback from user";

class DiffRevertFailedError extends Error {
    public constructor(public readonly cause: unknown) {
        super("Failed to revert while generating diff");
        this.name = "DiffRevertFailedError";
    }
}

const LogseqCommitChangesArgsZodObj = z.object({});

type LogseqCommitChangesArgs = z.infer<typeof LogseqCommitChangesArgsZodObj>;

type LogseqCommitChangesResult = ChatToolSuccessResult<{changes: string}> | ChatToolErrorResult;

type PreparedReview =
    | {kind: "no-graph-mutations"}
    | {kind: "no-reviewable-page-changes"}
    | {kind: "reviewable-page-changes"; changes: LogseqPrintedPageChange[]};

export class LogseqCommitChangesTool extends BaseChatToolWithCustomUI<
    LogseqCommitChangesArgs,
    LogseqCommitChangesResult
> {
    static readonly NAME = "logseq_commit_changes";

    readonly name = LogseqCommitChangesTool.NAME;
    readonly type = "human";
    readonly display = "standalone";
    readonly description =
        "Ask the user to review and approve committing applied uncommitted Logseq graph changes made by block/page editing tools.";
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
                    {
                        changes: "No uncommitted changes are available to review or commit."
                    },
                    createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                );
            }

            await transactionTracker.execute({signal: context?.abortSignal});
            if (!transactionTracker.hasAppliedGraphMutations()) {
                transactionTracker.clear();
                return ChatToolResponse.success(
                    {
                        changes: "No uncommitted changes are available to review or commit."
                    },
                    createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                );
            }
            transactionTracker.clear();

            return ChatToolResponse.success(
                {
                    changes: "Committed changes successfully. They are now committed changes."
                },
                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to commit Logseq changes: ${getErrorMessageFromErrObj(err)}. Uncommitted changes remain available.`,
                getTrackerArtifactFromError(err)
            );
        }
    }

    async prepareReview(
        transactionTracker: LogseqReversibleTransactionTracker
    ): Promise<PreparedReview> {
        await transactionTracker.execute();
        if (!transactionTracker.hasAppliedGraphMutations()) {
            return {kind: "no-graph-mutations"};
        }
        const changedPages = transactionTracker.getChangedPages();
        let afterChanges: LogseqPrintedPageSnapshot[];
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
        const changes = LogseqPageDataPrinter.createChanges(beforeChanges, afterChanges);

        return changes.length === 0
            ? {kind: "no-reviewable-page-changes"}
            : {kind: "reviewable-page-changes", changes};
    }

    async executeCancel(
        transactionTracker?: LogseqReversibleTransactionTracker
    ): Promise<ChatToolResponse<LogseqCommitChangesResult>> {
        transactionTracker?.clear();
        return ChatToolResponse.error(
            "The commit was declined. Uncommitted changes were discarded.",
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
        const messageId = useAuiState((state) => state.message.id);
        const {stop} = useStopThread();
        const [isReviewing, setIsReviewing] = useState(false);
        const noChangesResultAddedRef = useRef(false);
        const persistTrackerArtifact = usePersistLogseqTrackerArtifact();

        const isAwaitingResult = result === undefined && status?.type !== "incomplete";
        const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
        const hasGraphMutations = (locatedTracker?.tracker.getGraphMutationCommandCount() ?? 0) > 0;

        useEffect(() => {
            if (!isAwaitingResult || hasGraphMutations || noChangesResultAddedRef.current) return;

            noChangesResultAddedRef.current = true;
            void this.executeApprove({}, {messages}).then(addResult);
        }, [addResult, hasGraphMutations, isAwaitingResult, messages]);

        const reviewAndCommit = async () => {
            setIsReviewing(true);
            try {
                const located = findLastLogseqReversibleTransactionTracker(messages);
                const transactionTracker =
                    located?.tracker ?? getLastLogseqReversibleTransactionTracker(messages);
                let prepared: PreparedReview;
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
                                `Failed to generate diff as revert failed due to: ${causeMessage}. Uncommitted changes were discarded.`,
                                createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                            )
                        );
                        logger.error("Failed to generate diff as revert failed", cause);
                        if (located) {
                            await persistTrackerArtifact({...located, tracker: transactionTracker});
                        }
                        await logseq.UI.showMsg(
                            `Failed to generate diff as revert failed due to: ${causeMessage}. Uncommitted changes were discarded.`,
                            "error"
                        );
                        return;
                    }

                    if (located) {
                        await persistTrackerArtifact({...located, tracker: transactionTracker});
                    }
                    addResult(
                        ChatToolResponse.error(
                            `${getErrorMessageFromErrObj(error)}. Uncommitted changes remain available.`,
                            createLogseqReversibleTransactionTrackerArtifact(transactionTracker)
                        )
                    );
                    return;
                }

                if (prepared.kind === "no-graph-mutations") {
                    addResult(await this.executeApprove({}, {messages}, transactionTracker));
                    return;
                }
                if (prepared.kind === "no-reviewable-page-changes") {
                    transactionTracker.clear();
                    const artifact =
                        createLogseqReversibleTransactionTrackerArtifact(transactionTracker);
                    if (located) {
                        try {
                            await persistTrackerArtifact({...located, tracker: transactionTracker});
                        } catch (error) {
                            addResult(
                                ChatToolResponse.error(
                                    `No reviewable page changes were found, but the cleared tracker could not be persisted: ${getErrorMessageFromErrObj(error)}. Uncommitted changes were discarded.`,
                                    artifact
                                )
                            );
                            return;
                        }
                    }
                    addResult(
                        ChatToolResponse.success(
                            {changes: "No reviewable page changes are available to commit."},
                            artifact
                        )
                    );
                    return;
                }

                if (located) {
                    await persistTrackerArtifact({...located, tracker: transactionTracker});
                }
                const reviewResult = await showAIChangesReviewModal(prepared.changes);

                switch (reviewResult) {
                    case null:
                        // Header close and Escape defer review and leave the tool pending.
                        return;
                    case "discard":
                        addResult(await this.executeCancel(transactionTracker));
                        return;
                    case "commit":
                        addResult(await this.executeApprove({}, {messages}, transactionTracker));
                        return;
                    case "continue-later": {
                        const stopResult = await stop({
                            errorMessage: COMMIT_LATER_MESSAGE,
                            target: {
                                messageId,
                                toolCallId: props.toolCallId,
                                toolName: LogseqCommitChangesTool.NAME
                            }
                        });
                        if (!stopResult?.didStop) {
                            logger.error(
                                "Unable to defer CommitTool because its pending call changed"
                            );
                            try {
                                await logseq.UI.showMsg(
                                    "The commit review could not be deferred and remains pending",
                                    "error"
                                );
                            } catch (notificationError) {
                                logger.error(
                                    "Failed to show CommitTool defer error",
                                    notificationError
                                );
                            }
                        }
                        return;
                    }
                }
            } catch (error) {
                addResult(
                    ChatToolResponse.error(
                        `${getErrorMessageFromErrObj(error)}. Uncommitted changes remain available.`
                    )
                );
            } finally {
                setIsReviewing(false);
            }
        };

        if (!isAwaitingResult || !hasGraphMutations) {
            // Use the generic tool UI unless there are uncommitted changes to review.
            return <ToolFallback {...props} />;
        }

        return (
            <div className="w-full rounded-lg border bg-background p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium">
                    <GitCommitIcon className="size-4" />
                    Review and commit uncommitted Logseq changes
                </div>
                <div className="mb-3 text-muted-foreground">
                    AI Chat has uncommitted Logseq changes ready for your review.
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={reviewAndCommit} disabled={isReviewing}>
                        Review & Commit
                    </Button>
                </div>
            </div>
        );
    };
}
