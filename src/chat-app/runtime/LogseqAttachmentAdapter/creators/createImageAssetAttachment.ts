import type {CreateAttachment} from "@assistant-ui/react";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import type {LogseqEntity} from "../types";
import {createAssetPath} from "../utils/createAssetPath";

async function fetchAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function createImageAssetAttachment(
    entity: LogseqEntity,
    uuid: string
): Promise<CreateAttachment> {
    const path = createAssetPath(entity);
    const format = LogseqEditor.getAssetFormat(entity);
    const imageUrl = await WindowParentBridge.makeAssetUrl(path);
    const mimeType = `image/${format}`;
    const image = await fetchAsBase64(imageUrl);

    return {
        id: uuid,
        type: "image",
        name: path.split("/").at(-1) ?? path,
        contentType: mimeType,
        content: [{type: "image", image}]
    };
}
