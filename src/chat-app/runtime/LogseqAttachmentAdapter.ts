import type {
    Attachment,
    AttachmentAdapter,
    CompleteAttachment,
    CreateAttachment,
    PendingAttachment
} from "@assistant-ui/react";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {ATTACHMENT_IMAGE_FORMAT} from "src/constants";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import getUUIDFromBlock from "src/logseq/utils/getUUIDFromBlock";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";

export const LOGSEQ_ATTACHMENT_CONTENT_TYPE = "application/vnd.logseq.attachment+json";

export const LOGSEQ_ATTACHMENT_TYPES = {
    block: "logseq-block",
    page: "logseq-page",
    propertyPage: "logseq-property-page",
    tagPage: "logseq-tag-page",
    pdf: "logseq-pdf"
} as const;

type LogseqEntity = BlockEntity | PageEntity;

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

export async function createLogseqAttachmentFromUuid(uuid: string): Promise<CreateAttachment> {
    return await createLogseqAttachment(await resolveLogseqAttachmentEntity(uuid));
}

export async function resolveLogseqAttachmentEntity(uuid: string): Promise<LogseqEntity> {
    if (await LogseqEditor.isTagBlock(uuid)) {
        const tag = await logseq.Editor.getTag(uuid);
        if (tag) return tag;
    }

    const propertyBlock = await logseq.Editor.getBlock(uuid);
    if (propertyBlock && (await LogseqEditor.isPropertyBlock(propertyBlock))) {
        const property = await LogseqEditor.getProperty(uuid);
        if (property) return property as unknown as PageEntity;
    }

    const block = await LogseqPropertiesHelper.getBlock(uuid);
    if (block && typeof block.content === "string") return block;

    const page = await LogseqPropertiesHelper.getPage(uuid);
    if (page) return page;

    throw new Error(`Logseq entity not found: ${uuid}`);
}

export async function createLogseqAttachment(entity: LogseqEntity): Promise<CreateAttachment> {
    const uuid = getUUIDFromBlock(entity);
    if (!uuid) throw new Error("Cannot create a Logseq attachment without a UUID.");

    if (LogseqEditor.isImageAssetBlock(entity)) {
        return await createImageAssetAttachment(entity, uuid);
    }

    if (LogseqEditor.isPdfAssetBlock(entity)) {
        const path = createAssetPath(entity);
        return createTextAttachment(LOGSEQ_ATTACHMENT_TYPES.pdf, uuid, `PDF: ${path}`, path);
    }

    if (await LogseqEditor.isTagBlock(entity)) {
        return createTextAttachment(
            LOGSEQ_ATTACHMENT_TYPES.tagPage,
            uuid,
            getEntityName(entity, "Tag page"),
            `Tag Page UUID: ${uuid}`
        );
    }

    if (await LogseqEditor.isPropertyBlock(entity)) {
        return createTextAttachment(
            LOGSEQ_ATTACHMENT_TYPES.propertyPage,
            uuid,
            getEntityName(entity, "Property page"),
            `Property Page UUID: ${uuid}`
        );
    }

    if (await LogseqEditor.isPageBlock(entity)) {
        return createTextAttachment(
            LOGSEQ_ATTACHMENT_TYPES.page,
            uuid,
            getEntityName(entity, "Page"),
            `Page UUID: ${uuid}`
        );
    }

    return createTextAttachment(
        LOGSEQ_ATTACHMENT_TYPES.block,
        uuid,
        getEntityName(entity, "Block"),
        `Block UUID: ${uuid}`
    );
}

function createTextAttachment(
    type: string,
    uuid: string,
    name: string,
    text: string
): CreateAttachment {
    return {
        id: `${type}:${uuid}`,
        type,
        name,
        contentType: LOGSEQ_ATTACHMENT_CONTENT_TYPE,
        content: [{type: "text", text}]
    };
}

async function createImageAssetAttachment(
    entity: LogseqEntity,
    uuid: string
): Promise<CreateAttachment> {
    const path = createAssetPath(entity);
    const format = LogseqEditor.getAssetFormat(entity);
    const image = await WindowParentBridge.makeAssetUrl(path);

    return {
        id: `logseq-image:${uuid}`,
        type: "image",
        name: path.split("/").at(-1) ?? path,
        contentType: `image/${format}`,
        content: [{type: "image", image}]
    };
}

function createAssetPath(entity: LogseqEntity): string {
    const format = LogseqEditor.getAssetFormat(entity);
    const record = entity as unknown as Record<string, unknown>;
    const title = record.fullTitle ?? record.title ?? entity.content;
    if (
        typeof title !== "string" ||
        !title.trim() ||
        (!(ATTACHMENT_IMAGE_FORMAT as readonly string[]).includes(format) && format !== "pdf")
    ) {
        throw new Error("Cannot resolve the Logseq asset path.");
    }
    return `../assets/${title}.${format}`;
}

function getEntityName(entity: LogseqEntity, fallback: string): string {
    const record = entity as unknown as Record<string, unknown>;
    const name = record.fullTitle ?? record.title ?? entity.content;
    return typeof name === "string" && name.trim() ? name : fallback;
}
