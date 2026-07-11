import type {BlockEntity, EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {isPageSoftDeleted} from "./isPageSoftDeleted";

type EntityReferenceWithID = {id: EntityID};

function resolvePageIdentity(reference: BlockEntity["page"]): EntityID | PageIdentity | undefined {
    if (typeof reference === "number") return reference;
    if (typeof reference !== "object" || reference === null) return undefined;
    if ("uuid" in reference && typeof reference.uuid === "string") {
        return reference.uuid as PageIdentity;
    }
    if ("id" in reference && typeof (reference as EntityReferenceWithID).id === "number") {
        return (reference as EntityReferenceWithID).id;
    }

    return undefined;
}

export async function isBlockSoftDeleted(block: BlockEntity): Promise<boolean> {
    const pageIdentity = (await LogseqEditor.isPageBlock(block))
        ? (block.id || {uuid: block.uuid})
        : resolvePageIdentity(await logseq.Editor.getBlock(block.id || {uuid: block.uuid}));
    if (!pageIdentity) throw new Error(`Block page reference is missing: ${pageIdentity}`);

    const page = await logseq.Editor.getPage(pageIdentity);
    if (!page) throw new Error(`Page not found for block: ${block.uuid}`);

    return isPageSoftDeleted(page);
}
