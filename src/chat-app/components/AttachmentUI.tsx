import {AttachmentPrimitive, ComposerPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import type {FC} from "react";
import {
    AttachmentPreviewDialog,
    AttachmentRemove,
    AttachmentThumb
} from "src/shadcn/assistant-ui/attachment";
import {cn} from "src/shadcn/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "src/shadcn/radix-ui/tooltip";
import {LOGSEQ_BLOCK_ATTACHMENT_TYPE} from "../runtime/LogseqBlockAttachmentAdapter";

/**
 * This is the attachment ui manger.
 *
 * Changes:
 * (a) Added logseq block type
 */
export const AttachmentUI: FC = () => {
    const aui = useAui();
    const isComposer = aui.attachment.source !== "message";

    const isImage = useAuiState((s) => s.attachment.type === "image");
    const typeLabel = useAuiState((s) => {
        const type = s.attachment.type;
        switch (type) {
            case "image":
                return "Image";
            case "document":
                return "Document";
            case "file":
                return "File";
            case LOGSEQ_BLOCK_ATTACHMENT_TYPE:
                return "logseq-block";
            default:
                return type;
        }
    });

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <AttachmentPrimitive.Root
                    className={cn(
                        "aui-attachment-root relative",
                        isImage && "aui-attachment-root-composer only:*:first:size-24"
                    )}>
                    <AttachmentPreviewDialog>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border bg-muted transition-opacity hover:opacity-75"
                                aria-label={`${typeLabel} attachment`}>
                                <AttachmentThumb />
                            </button>
                        </TooltipTrigger>
                    </AttachmentPreviewDialog>
                    {isComposer && <AttachmentRemove />}
                </AttachmentPrimitive.Root>
                <TooltipContent side="top">
                    <AttachmentPrimitive.Name />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
