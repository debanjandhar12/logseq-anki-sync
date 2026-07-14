import {AttachmentPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {
    AlertCircleIcon,
    CircleParkingIcon,
    FileIcon,
    FileTextIcon,
    HashIcon,
    ImageIcon,
    Loader2Icon,
    TextSelectIcon
} from "lucide-react";
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
import {LOGSEQ_ATTACHMENT_TYPES} from "../runtime/LogseqAttachmentAdapter";

/**
 * This is the attachment ui manger.
 *
 * Changes:
 * (a) Added Logseq entity attachment types and icons
 * (b) Reduced attachment width and prevented shrinking in scroll containers
 * (c) Change the ui style to pills instead of boxes.
 * (d) Shows current upstream upload and failure states.
 */
export const AttachmentUI: FC = () => {
    const aui = useAui();
    const isComposer = aui.attachment.source !== "message";

    const typeLabel = useAuiState((s) => {
        const type = s.attachment.type;
        switch (type) {
            case "image":
                return "Image";
            case "document":
                return "Document";
            case "file":
                return "File";
            case LOGSEQ_ATTACHMENT_TYPES.block:
                return "Logseq block";
            case LOGSEQ_ATTACHMENT_TYPES.page:
                return "Logseq page";
            case LOGSEQ_ATTACHMENT_TYPES.propertyPage:
                return "Logseq property page";
            case LOGSEQ_ATTACHMENT_TYPES.tagPage:
                return "Logseq tag page";
            case LOGSEQ_ATTACHMENT_TYPES.pdf:
                return "Logseq PDF";
            default:
                return type;
        }
    });
    const isUploading = useAuiState((state) => state.attachment.status.type === "running");
    const hasUploadError = useAuiState(
        (state) =>
            state.attachment.status.type === "incomplete" &&
            state.attachment.status.reason === "error"
    );

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <AttachmentPrimitive.Root className="aui-attachment-root relative max-w-40 shrink-0">
                    <AttachmentPreviewDialog>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "aui-attachment-tile relative flex h-7 max-w-40 cursor-pointer items-center gap-1 overflow-hidden rounded-full border bg-muted px-2.5 pr-3 transition-colors hover:bg-muted/75",
                                    hasUploadError && "border-destructive"
                                )}
                                aria-label={`${typeLabel} attachment${
                                    hasUploadError
                                        ? ", upload failed"
                                        : isUploading
                                          ? ", uploading"
                                          : ""
                                }`}>
                                <span className="size-5 shrink-0 overflow-hidden rounded-sm">
                                    <LogseqAttachmentThumb />
                                </span>
                                <span className="truncate text-xs">
                                    <AttachmentPrimitive.Name />
                                </span>
                                {isUploading && (
                                    <span className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
                                        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
                                    </span>
                                )}
                                {hasUploadError && (
                                    <span className="bg-destructive/10 absolute inset-0 flex items-center justify-center">
                                        <AlertCircleIcon className="text-destructive size-4" />
                                    </span>
                                )}
                            </button>
                        </TooltipTrigger>
                    </AttachmentPreviewDialog>
                    {isComposer && <AttachmentRemove />}
                </AttachmentPrimitive.Root>
                <TooltipContent side="top">
                    <AttachmentPrimitive.Name />
                    {hasUploadError && <p>Upload failed</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const LogseqAttachmentThumb: FC = () => {
    const type = useAuiState((s) => s.attachment.type);
    const iconClassName = "size-4 text-muted-foreground";

    switch (type) {
        case "image":
            return <ImageIcon className={iconClassName} />;
        case LOGSEQ_ATTACHMENT_TYPES.block:
            return <TextSelectIcon className={iconClassName} />;
        case LOGSEQ_ATTACHMENT_TYPES.page:
            return <FileIcon className={iconClassName} />;
        case LOGSEQ_ATTACHMENT_TYPES.propertyPage:
            return <CircleParkingIcon className={iconClassName} />;
        case LOGSEQ_ATTACHMENT_TYPES.tagPage:
            return <HashIcon className={iconClassName} />;
        case LOGSEQ_ATTACHMENT_TYPES.pdf:
            return <FileTextIcon className={iconClassName} />;
        default:
            return <AttachmentThumb />;
    }
};
