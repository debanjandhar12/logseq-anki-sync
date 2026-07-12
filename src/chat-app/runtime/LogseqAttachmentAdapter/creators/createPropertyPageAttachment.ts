import type {CreateAttachment} from "@assistant-ui/react";
import {LOGSEQ_ATTACHMENT_TYPES} from "../constants";
import type {LogseqEntity} from "../types";
import {getEntityName} from "../utils/getEntityName";
import {createTextAttachment} from "./createTextAttachment";

export function createPropertyPageAttachment(entity: LogseqEntity, uuid: string): CreateAttachment {
    return createTextAttachment({
        type: LOGSEQ_ATTACHMENT_TYPES.propertyPage,
        uuid,
        name: getEntityName(entity, "Property page"),
        text: `Property Page UUID: ${uuid}`
    });
}
