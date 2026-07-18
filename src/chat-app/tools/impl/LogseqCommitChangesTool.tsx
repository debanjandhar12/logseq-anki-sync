import {type ToolCallMessagePartComponent, useAuiState} from "@assistant-ui/react";
import {GitCommitIcon} from "lucide-react";
import {useState} from "react";
import {ToolFallback} from "src/chat-app/components/ToolFallback";
import {useLogseqReversibleTransactionLifecycleContext} from "src/chat-app/context/LogseqReversibleTransactionLifecycleContext";
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
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    LogseqPageDataPrinter,
    type LogseqReversibleTransactionTracker
} from "src/core/logseq-reversible-transaction-tracker";
import {Button} from "src/shadcn/radix-ui/button";
import {showAIChangesReviewModal} from "src/ui/launchers/showAIChangesReviewModal";
import {z} from "zod";

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
            if (transactionTracker.getCommands().length === 0) {
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
                `Failed to commit Logseq changes: ${getErrorMessageFromErrObj(err)}`
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
        } finally {
            await transactionTracker.revertImmediately();
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
        const {cancelScheduledRevert, persistTrackerArtifact} =
            useLogseqReversibleTransactionLifecycleContext();

        const isPending = result === undefined && status?.type !== "incomplete";

        const reviewAndApply = async () => {
            setIsReviewing(true);
            try {
                cancelScheduledRevert();
                const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
                const transactionTracker =
                    locatedTracker?.tracker ?? getLastLogseqReversibleTransactionTracker(messages);
                const {beforeChanges, afterChanges, hasGraphMutations} =
                    await this.prepareReview(transactionTracker);
                if (locatedTracker) {
                    await persistTrackerArtifact({...locatedTracker, tracker: transactionTracker});
                }
                if (!hasGraphMutations) {
                    addResult(await this.executeApprove({}, {messages}, transactionTracker));
                    return;
                }
                const isApproved = await showAIChangesReviewModal(beforeChanges, afterChanges);

                if (isApproved !== true) {
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

        if (!isPending) {
            // fallback to original ui when not pending
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
