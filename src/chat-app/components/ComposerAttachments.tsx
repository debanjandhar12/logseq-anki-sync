import type {FC} from "react";
import {AttachmentPrimitive, ComposerPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {Tooltip, TooltipContent, TooltipTrigger} from "src/shadcn/radix-ui/tooltip";
import {cn} from "src/shadcn/lib/utils";
import {AttachmentPreviewDialog, AttachmentRemove, AttachmentThumb} from "src/shadcn/assistant-ui/attachment";

export const ComposerAttachments: FC = () => {
    return (
        <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
            <ComposerPrimitive.Attachments>
                {() => <AttachmentUI />}
            </ComposerPrimitive.Attachments>
        </div>
    );
};

const AttachmentUI: FC = () => {
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
            default:
                return type;
        }
    });

    return (
        <Tooltip>
            <AttachmentPrimitive.Root
                className={cn(
                    "aui-attachment-root relative",
                    isImage && "aui-attachment-root-composer only:*:first:size-24",
                )}
            >
                <AttachmentPreviewDialog>
                    <TooltipTrigger asChild>
                        <div
                            className="aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border bg-muted transition-opacity hover:opacity-75"
                            role="button"
                            tabIndex={0}
                            aria-label={`${typeLabel} attachment`}
                        >
                            <AttachmentThumb />
                        </div>
                    </TooltipTrigger>
                </AttachmentPreviewDialog>
                {isComposer && <AttachmentRemove />}
            </AttachmentPrimitive.Root>
            <TooltipContent side="top">
                <AttachmentPrimitive.Name />
            </TooltipContent>
        </Tooltip>
    );
};