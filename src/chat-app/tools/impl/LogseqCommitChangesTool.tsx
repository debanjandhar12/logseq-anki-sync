import {type ToolCallMessagePartComponent, useAuiState} from "@assistant-ui/react";
import {ToolResponse} from "assistant-stream";
import {GitCommitIcon} from "lucide-react";
import {useState} from "react";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithCustomUI} from "src/chat-app/tools/base/BaseChatToolWithCustomUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {ToolFallback} from "src/shadcn/assistant-ui/tool-fallback";
import {Button} from "src/shadcn/radix-ui/button";
import {showAIChangesReviewModal} from "src/ui/launchers/showAIChangesReviewModal";
import {z} from "zod";

const LogseqCommitChangesArgsZodObj = z.object({});

type LogseqCommitChangesArgs = z.infer<typeof LogseqCommitChangesArgsZodObj>;

type LogseqCommitChangesResult =
    | {
          success: true;
          changes: string;
      }
    | {
          success: false;
          error: string;
      };

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
        context?: ChatToolExecutionContext
    ): Promise<LogseqCommitChangesResult | ToolResponse<LogseqCommitChangesResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            await transactionTracker.executeInLogseq();
            transactionTracker.clear();

            return new ToolResponse({
                result: {success: true, changes: "Committed pending Logseq changes."},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (err) {
            return new ToolResponse({
                result: {
                    success: false,
                    error: `Failed to commit Logseq changes: ${getErrorMessageFromErrObj(err)}`
                },
                isError: true
            });
        }
    }

    async executeCancel(): Promise<
        LogseqCommitChangesResult | ToolResponse<LogseqCommitChangesResult>
    > {
        return new ToolResponse({
            result: {
                success: false,
                error: "User cancelled the commit operation. Note: In memory changes not cleared."
            }
        });
    }

    readonly render: ToolCallMessagePartComponent<
        LogseqCommitChangesArgs,
        LogseqCommitChangesResult
    > = (props) => {
        const {result, addResult, status} = props;
        const messages = useAuiState((state) => state.thread.messages);
        const [isReviewing, setIsReviewing] = useState(false);

        const isPending = result === undefined && status?.type !== "incomplete";

        const reviewAndApply = async () => {
            setIsReviewing(true);
            try {
                const transactionTracker = getLastLogseqFakeableTransactionTracker(messages);
                const inMemoryExecutor = await transactionTracker.executeInTheInMemoryDB();
                const isApproved = await showAIChangesReviewModal(
                    inMemoryExecutor.getInMemoryPageDataDb(),
                    inMemoryExecutor.getOriginalInMemoryPageDataDb()
                );

                if (isApproved === false) {
                    const cancelResult = ToolResponse.toResponse(await this.executeCancel());
                    addResult(cancelResult);
                } else if (isApproved === true) {
                    const commitResult = ToolResponse.toResponse(
                        await this.executeApprove({}, {messages})
                    );
                    addResult(commitResult);
                } // else ignore if isApproved is null (showAIChangesReviewModal returns null if closed without accepting or rejecting)
            } catch (error) {
                addResult(
                    new ToolResponse({
                        result: {success: false, error: getErrorMessageFromErrObj(error)},
                        isError: true
                    })
                );
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
