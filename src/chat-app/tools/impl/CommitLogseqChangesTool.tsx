import {type ToolCallMessagePartComponent, useAuiState} from "@assistant-ui/react";
import {ToolResponse} from "assistant-stream";
import {CheckIcon, GitCommitIcon, XIcon} from "lucide-react";
import {useState} from "react";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {
    createLogseqFakeableTransactionTrackerArtifact,
    getLastLogseqFakeableTransactionTracker
} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {ToolFallback} from "src/shadcn/assistant-ui/tool-fallback";
import {Button} from "src/shadcn/radix-ui/button";
import {z} from "zod";
import {BaseChatTool} from "../base/BaseChatTool";

const commitLogseqChangesParameters = z.object({});

type CommitLogseqChangesArgs = z.infer<typeof commitLogseqChangesParameters>;

type LogseqCommitResult =
    | {
          success: true;
          changes: string;
      }
    | {
          success: false;
          error: string;
      };

export class CommitLogseqChangesTool extends BaseChatTool<
    CommitLogseqChangesArgs,
    LogseqCommitResult
> {
    static readonly NAME = "CommitLogseqChanges";

    readonly name = CommitLogseqChangesTool.NAME;
    readonly type = "human";
    readonly description =
        "Ask the user to approve committing pending Logseq graph changes made by block/page editing tools.";
    readonly parameters = commitLogseqChangesParameters;

    async execute(
        _args: CommitLogseqChangesArgs = {},
        context?: ChatToolExecutionContext
    ): Promise<LogseqCommitResult | ToolResponse<LogseqCommitResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            await transactionTracker.executeInLogseq();
            transactionTracker.clear();

            return new ToolResponse({
                result: {success: true, changes: "Committed pending Logseq changes."},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker) as any
            });
        } catch (err) {
            return {
                success: false,
                error: `Failed to commit Logseq changes: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }

    readonly render: ToolCallMessagePartComponent<CommitLogseqChangesArgs, LogseqCommitResult> = (
        props
    ) => {
        const {result, addResult, status} = props;
        const messages = useAuiState((state) => state.thread.messages);
        const [isApproving, setIsApproving] = useState(false);
        const [isRejecting, setIsRejecting] = useState(false);

        const isPending = result === undefined && status?.type !== "incomplete";
        const isBusy = isApproving || isRejecting;

        const approve = async () => {
            setIsApproving(true);
            try {
                const commitResult = ToolResponse.toResponse(await this.execute({}, {messages}));
                addResult(commitResult);
            } catch (error) {
                addResult(
                    new ToolResponse({
                        result: {success: false, error: getErrorMessageFromErrObj(error)},
                        isError: true
                    })
                );
            } finally {
                setIsApproving(false);
            }
        };

        const reject = () => {
            setIsRejecting(true);
            addResult(
                new ToolResponse({
                    result: {success: false, error: "User rejected the Logseq commit operation."},
                    isError: true
                })
            );
        };

        if (!isPending) {
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
                    <Button size="sm" onClick={approve} disabled={isBusy}>
                        <CheckIcon />
                        {isApproving ? "Committing" : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={reject} disabled={isBusy}>
                        <XIcon />
                        Reject
                    </Button>
                </div>
            </div>
        );
    };
}
