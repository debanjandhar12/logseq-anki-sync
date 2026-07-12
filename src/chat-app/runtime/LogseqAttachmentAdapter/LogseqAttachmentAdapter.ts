import type {
    Attachment,
    AttachmentAdapter,
    CompleteAttachment,
    PendingAttachment
} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_CONTENT_TYPE} from "./constants";

/** Registers the app-owned Logseq attachment MIME type with assistant-ui. */
export class LogseqAttachmentAdapter implements AttachmentAdapter {
    readonly accept = LOGSEQ_ATTACHMENT_CONTENT_TYPE;

    async add(): Promise<PendingAttachment> {
        throw new Error("Logseq attachments must be created from a Logseq entity.");
    }

    async send(_attachment: PendingAttachment): Promise<CompleteAttachment> {
        throw new Error("Logseq entity attachments are complete when added.");
    }

    async remove(_attachment: Attachment): Promise<void> {}
}
