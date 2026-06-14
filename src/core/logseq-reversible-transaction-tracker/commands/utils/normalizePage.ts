import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {normalizeBlock} from "./normalizeBlock";

function isBlockEntity(value: unknown): value is BlockEntity {
    return typeof value === "object" && value !== null && "id" in value && "uuid" in value;
}

export async function normalizePage(page: PageEntity): Promise<PageEntity> {
    if (!page?.uuid && typeof page?.id === "number") {
        const completePage = await logseq.Editor.getPage(page.id);
        if (!completePage?.uuid) throw new Error(`Unable to resolve page UUID: ${page.id}`);
        page = {...completePage, ...page, uuid: completePage.uuid};
    }

    if (!page?.uuid) throw new Error("Page UUID is missing");

    const normalizedPage = {...page} as PageEntity;
    if (Array.isArray(page.children)) {
        normalizedPage.children = (await Promise.all(
            page.children.map(async (child) => {
                if (isBlockEntity(child)) return await normalizeBlock(child);
                return child;
            })
        )) as PageEntity[];
    }

    return normalizedPage;
}
