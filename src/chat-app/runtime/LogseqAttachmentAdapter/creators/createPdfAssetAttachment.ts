import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {createAssetPath} from "../utils/createAssetPath";
import {createTextAttachment} from "./createTextAttachment";

export function createPdfAssetAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    const path = createAssetPath(entity);
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.pdf,
        uuid,
        name: `PDF: ${path}`,
        text: path
    });
}
