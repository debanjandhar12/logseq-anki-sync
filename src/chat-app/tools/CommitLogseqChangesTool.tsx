import {Tool, ToolResponse} from "assistant-stream";
import {ToolCallMessagePartComponent} from "@assistant-ui/react";
import {useState} from "react";

type LogseqCommitResult =
    | {
    success: true;
    changes: string;
}
    | {
    success: false;
    error: string;
};

export const CommitLogseqChangesTool: Tool<{}, LogseqCommitResult> =  {
    type: "frontend",
    description:
        "Commit changes done by UpsertLogseqBlockTool, AppendLogseqBlockTool, DeleteLogseqBlockTool, CreateLogseqPageTool, DeleteLogseqPageTool."
    // TBU: define params using zod
}

export const ReadLogseqBlockToolUI: ToolCallMessagePartComponent<
    {},
    LogseqCommitResult
> = ({args, result, addResult, status}) => {
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const isPending = result === undefined && status?.type !== "incomplete";
    const isBusy = isApproving || isRejecting;

    const approve = async () => {
        setIsApproving(true);
        try {
            // TBU: implement logic
            // call addResult with new ToolResponse
        } catch (error) {
            addResult(
                new ToolResponse({
                    result: {success: false, error: getErrorMessage(error)},
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

    return (
        {/* return improved ui... when commiting we will show toolname and below subtext: AI Chat wants to make changes to your logseq graph
        It will have approve and reject button. When approved or rejected, we will use the normal tools ui.
        In other words, we will return the default ui when not approving or rejecting. */}
    );
};

async function execute({}): Promise<LogseqCommitResult> {
    // TBU: i will implement this later
    return {success: false, error: "Not implemented yet."};
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "Unknown error";
}
