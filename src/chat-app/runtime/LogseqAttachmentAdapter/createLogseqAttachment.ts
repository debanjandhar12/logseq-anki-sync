import type {CreateAttachment} from "@assistant-ui/react";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import getUUIDFromBlock from "src/logseq/utils/getUUIDFromBlock";
import {createBlockAttachment} from "./creators/createBlockAttachment";
import {createImageAssetAttachment} from "./creators/createImageAssetAttachment";
import {createPageAttachment} from "./creators/createPageAttachment";
import {createPdfAssetAttachment} from "./creators/createPdfAssetAttachment";
import {createPropertyPageAttachment} from "./creators/createPropertyPageAttachment";
import {createTagPageAttachment} from "./creators/createTagPageAttachment";
import type {LogseqEntity} from "./types";

export async function createLogseqAttachment(entity: LogseqEntity): Promise<CreateAttachment> {
    const uuid = getUUIDFromBlock(entity);
    if (!uuid) throw new Error("Cannot create a Logseq attachment without a UUID.");

    if (LogseqEditor.isImageAssetBlock(entity)) {
        return await createImageAssetAttachment(entity, uuid);
    }

    if (LogseqEditor.isPdfAssetBlock(entity)) {
        return createPdfAssetAttachment(entity, uuid);
    }

    if (await LogseqEditor.isTagBlock(entity)) {
        return createTagPageAttachment(entity, uuid);
    }

    if (await LogseqEditor.isPropertyBlock(entity)) {
        return createPropertyPageAttachment(entity, uuid);
    }

    if (await LogseqEditor.isPageBlock(entity)) {
        return createPageAttachment(entity, uuid);
    }

    return createBlockAttachment(entity, uuid);
}
