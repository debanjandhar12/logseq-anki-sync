import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {createAssetPath} from "../utils/createAssetPath";
import {createTextAttachment} from "../utils/createTextAttachment";

export function createPdfAssetAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    const path = createAssetPath(entity);
    const pdfName = path.split("/").pop() || path;
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.pdf,
        uuid,
        name: pdfName,
        text: createText(uuid, path, pdfName)
    });
}

const createText = (uuid, path, pdfName) => {
    return `PDF Path: ${path}\nPdf Block UUID: ${uuid}\nPDF Name: ${pdfName}`;
};
