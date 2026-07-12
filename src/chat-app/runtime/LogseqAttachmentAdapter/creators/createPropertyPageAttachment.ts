import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {createTextAttachment} from "../utils/createTextAttachment";
import {getEntityName} from "../utils/getEntityName";

export function createPropertyPageAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.propertyPage,
        uuid,
        name: getEntityName(entity, uuid),
        text: `Property Page UUID: ${uuid}\nProperty Page Name: ${getEntityName(entity, null)}`
    });
}
