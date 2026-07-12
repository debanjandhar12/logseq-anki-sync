import type {CreateAttachment} from "@assistant-ui/react";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {createLogseqAttachment} from "./createLogseqAttachment";
import type {LogseqEntity} from "./types";

export async function createLogseqAttachmentFromUuid(uuid: string): Promise<CreateAttachment> {
    return await createLogseqAttachment(await resolveLogseqAttachmentEntity(uuid));
}

async function resolveLogseqAttachmentEntity(uuid: string): Promise<LogseqEntity> {
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
