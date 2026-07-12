import type {CreateAttachment} from "@assistant-ui/react";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import type {LogseqEntity} from "../types";
import {createAssetPath} from "../utils/createAssetPath";

export async function createImageAssetAttachment(
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
