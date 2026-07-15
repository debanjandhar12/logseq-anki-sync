import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_CONTENT_TYPE} from "../constants";

interface TextAttachmentOptions {
    type: string;
    uuid: string;
    name: string;
    text: string;
}

export function createTextAttachment({
    type,
    uuid,
    name,
    text
}: TextAttachmentOptions): CreateAttachment {
    return {
        id: uuid,
        type,
        name,
        contentType: LOGSEQ_ATTACHMENT_CONTENT_TYPE,
        content: [{type: "text", text}]
    };
}
