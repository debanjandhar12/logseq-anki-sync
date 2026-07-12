import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {createTextAttachment} from "../utils/createTextAttachment";
import {getEntityName} from "../utils/getEntityName";

export function createTagPageAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.tagPage,
        uuid,
        name: getEntityName(entity, uuid),
        text: `Tag Page UUID: ${uuid}\nTag Page Name: ${getEntityName(entity, null)}`
    });
}
