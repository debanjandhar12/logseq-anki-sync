import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {type Tool, ToolResponse} from "assistant-stream";
import {CheckIcon, XIcon} from "lucide-react";
import {useState} from "react";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {Button} from "src/shadcn/radix-ui/button";

export const READ_LOGSEQ_BLOCK_TOOL_NAME = "ReadLogseqBlock";
export const UPSERT_LOGSEQ_BLOCK_TOOL_NAME = "UpsertLogseqBlock";


type UpsertLogseqBlockArgs = {
    uuid: string;
    newContent: string;
};

type ReadLogseqBlockResult =
    | {
          success: true;
          block: BlockEntity;
          parent?: BlockEntity | null;
      }
    | {
          success: false;
          error: string;
      };

type UpsertLogseqBlockResult =
    | {
          success: true;
          uuid: string;
          previousContent: string;
          newContent: string;
      }
    | {
          success: false;
          error: string;
      };

export const readLogseqBlockTool: Tool<ReadLogseqBlockArgs, ReadLogseqBlockResult> = {
    type: "frontend",
    description:
        "Read a Logseq block by UUID. Optionally include the direct parent block when includeParent is true.",
    parameters: {
        type: "object",
        properties: {
            uuid: {
                type: "string",
                description: "The UUID of the Logseq block to read."
            },
            includeParent: {
                type: "boolean",
                description: "Whether to include the direct parent block in the result."
            }
        },
        required: ["uuid"],
        additionalProperties: false
    },
    execute: readLogseqBlock
};

export const upsertLogseqBlockTool: Tool<UpsertLogseqBlockArgs, UpsertLogseqBlockResult> = {
    type: "human",
    description:
        "Update an existing Logseq block by UUID with new markdown content. This requires explicit user approval before the update is applied.",
    parameters: {
        type: "object",
        properties: {
            uuid: {
                type: "string",
                description: "The UUID of the Logseq block to update."
            },
            newContent: {
                type: "string",
                description: "The complete replacement markdown content for the block."
            }
        },
        required: ["uuid", "newContent"],
        additionalProperties: false
    }
};

export const UpsertLogseqBlockToolUI: ToolCallMessagePartComponent<
    UpsertLogseqBlockArgs,
    UpsertLogseqBlockResult
> = ({args, result, addResult, status}) => {
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    const isPending = result === undefined && status?.type !== "incomplete";
    const isBusy = isApproving || isRejecting;

    const approve = async () => {
        setIsApproving(true);
        try {
            const upsertResult = await upsertLogseqBlock(args);
            addResult(new ToolResponse({result: upsertResult, isError: !upsertResult.success}));
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
                result: {success: false, error: "User rejected the Logseq block update."},
                isError: true
            })
        );
    };

    return (
        <div className="w-full rounded-lg border bg-background p-3 text-sm">
            <div className="mb-2 font-medium">Logseq block update</div>
            <div className="mb-2 text-muted-foreground">
                <span className="font-medium text-foreground">UUID:</span> {args.uuid}
            </div>
            <pre className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-2 text-xs">
                {args.newContent}
            </pre>
            {isPending ? (
                <div className="flex gap-2">
                    <Button size="sm" onClick={approve} disabled={isBusy}>
                        <CheckIcon />
                        {isApproving ? "Updating" : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={reject} disabled={isBusy}>
                        <XIcon />
                        Reject
                    </Button>
                </div>
            ) : (
                <div className="text-muted-foreground">{getUpsertResultText(result)}</div>
            )}
        </div>
    );
};

export async function readLogseqBlock({
    uuid,
    includeParent = false
}: ReadLogseqBlockArgs): Promise<ReadLogseqBlockResult> {
    const block = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren: true});
    if (!block) {
        return {success: false, error: `Logseq block not found: ${uuid}`};
    }

    const parent =
        includeParent && block.parent?.id
            ? await LogseqPropertiesHelper.getBlock(block.parent.id, {includeChildren: false})
            : null;

    return {
        success: true,
        block,
        ...(includeParent ? {parent} : {})
    };
}

async function upsertLogseqBlock({
    uuid,
    newContent
}: UpsertLogseqBlockArgs): Promise<UpsertLogseqBlockResult> {
    const currentBlock = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren: false});
    if (!currentBlock) {
        return {success: false, error: `Logseq block not found: ${uuid}`};
    }

    await LogseqEditor.updateBlock(uuid, newContent);

    return {
        success: true,
        uuid,
        previousContent: currentBlock.content ?? "",
        newContent
    };
}

function getUpsertResultText(result: UpsertLogseqBlockResult | undefined): string | null {
    if (!result) return null;
    if (result.success) return "Block updated.";
    return "error" in result ? result.error : "Block update failed.";
}

