import type {
    Attachment,
    AttachmentAdapter,
    CompleteAttachment,
    CreateAttachment,
    PendingAttachment
} from "@assistant-ui/react";
import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import getUUIDFromBlock from "src/logseq/utils/getUUIDFromBlock";

export const LOGSEQ_BLOCK_ATTACHMENT_TYPE = "logseq-block";
export const LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE = "application/vnd.logseq.block+json";

export type LogseqBlockAttachmentPayload = {
    uuid: string;
    content: string;
};

export class LogseqBlockAttachmentAdapter implements AttachmentAdapter {
    public readonly accept = LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE;

    async add({file}: {file: File}): Promise<PendingAttachment> {
        return {
            id: file.name,
            type: LOGSEQ_BLOCK_ATTACHMENT_TYPE,
            name: file.name,
            contentType: file.type,
            file,
            status: {type: "requires-action", reason: "composer-send"}
        };
    }

    async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
        const payload = parseLogseqBlockAttachmentPayload(await readFileText(attachment.file));

        return {
            ...attachment,
            status: {type: "complete"},
            content: [createLogseqBlockMessagePart(payload)]
        };
    }

    async remove(_attachment: Attachment): Promise<void> {
        // No external resources are allocated for Logseq block attachments.
    }
}

export function createLogseqBlockAttachment(block: BlockEntity): CreateAttachment {
    const payload = createLogseqBlockAttachmentPayload(block);

    return {
        id: `logseq-block:${payload.uuid}`,
        type: LOGSEQ_BLOCK_ATTACHMENT_TYPE,
        name: createLogseqBlockAttachmentName(block, payload.uuid),
        contentType: LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE,
        content: [createLogseqBlockMessagePart(payload)]
    };
}

function createLogseqBlockAttachmentPayload(block: BlockEntity): LogseqBlockAttachmentPayload {
    const uuid = getUUIDFromBlock(block);
    if (!uuid) {
        throw new Error("Cannot create Logseq block attachment without a block UUID.");
    }

    return {
        uuid,
        content: serializeLogseqBlock(block)
    };
}

function parseLogseqBlockAttachmentPayload(rawPayload: string): LogseqBlockAttachmentPayload {
    const parsed = JSON.parse(rawPayload) as Partial<LogseqBlockAttachmentPayload>;
    if (typeof parsed.uuid !== "string" || typeof parsed.content !== "string") {
        throw new Error("Invalid Logseq block attachment payload.");
    }
    return {uuid: parsed.uuid, content: parsed.content};
}

function createLogseqBlockMessagePart(payload: LogseqBlockAttachmentPayload) {
    return {
        type: "text" as const,
        text: `<logseq-block uuid="${payload.uuid}">\n${payload.content}\n</logseq-block>`
    };
}

function createLogseqBlockAttachmentName(block: BlockEntity, uuid: string): string {
    const title = block.content
        ?.split("\n")
        .map((line) => line.trim())
        .find(Boolean);

    return title ? `Logseq block: ${title}` : `Logseq block: ${uuid}`;
}

function serializeLogseqBlock(block: BlockEntity, depth = 0): string {
    const indent = "  ".repeat(depth);
    const content = block.content?.trim() || `(empty block ${block.uuid})`;
    const lines = [`${indent}- ${content}`];

    for (const child of getBlockChildren(block)) {
        lines.push(serializeLogseqBlock(child, depth + 1));
    }

    return lines.join("\n");
}

function getBlockChildren(block: BlockEntity): BlockEntity[] {
    return Array.isArray(block.children) ? (block.children as BlockEntity[]) : [];
}

function readFileText(file: File): Promise<string> {
    if (typeof file.text === "function") {
        return file.text();
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
