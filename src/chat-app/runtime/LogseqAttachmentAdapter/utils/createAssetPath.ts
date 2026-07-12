import {ATTACHMENT_IMAGE_FORMAT} from "src/constants";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import type {LogseqEntity} from "../types";

export function createAssetPath(entity: LogseqEntity): string {
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
