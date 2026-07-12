import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {createTextAttachment} from "../utils/createTextAttachment";
import {getEntityName} from "../utils/getEntityName";

export function createPageAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.page,
        uuid,
        name: getEntityName(entity, uuid),
        text: `Page UUID: ${uuid}\nPage Name: ${getEntityName(entity, null)}`
    });
}
