import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {normalizeTagReferences} from "./normalizeTagReferences";
import {removeRefFromObj} from "./removeRefFromObj";

export async function normalizeTagPage(tagPage: PageEntity): Promise<PageEntity> {
    if (!tagPage?.uuid && typeof tagPage?.id === "number") {
        const completePage = await logseq.Editor.getPage(tagPage.id);
        if (!completePage?.uuid) throw new Error(`Unable to resolve tag page UUID: ${tagPage.id}`);
        tagPage = {...completePage, ...tagPage, uuid: completePage.uuid};
    }

    if (!tagPage?.uuid) throw new Error("Tag page UUID is missing");

    // :logseq.property.class/extends and :logseq.property.class/properties are included in
    // properties return from LogseqPropertiesHelper.getPage
    const pageWithProperties = await LogseqPropertiesHelper.getPage(tagPage.uuid);
    const normalizedTagPage = removeRefFromObj({
        ...pageWithProperties,
        ...tagPage,
        properties: {...pageWithProperties?.properties, ...tagPage.properties, uuid: tagPage.uuid}
    } as PageEntity);

    return await normalizeTagReferences(normalizedTagPage);
}
