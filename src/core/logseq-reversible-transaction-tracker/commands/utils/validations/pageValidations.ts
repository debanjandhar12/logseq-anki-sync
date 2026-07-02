import type {PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {isPageSoftDeleted} from "../isPageSoftDeleted";

function formatPageLabel(label: string | undefined): string {
    return label ? `${label} page` : "Page";
}

export async function requireExistingPage(
    pageIdentity: PageIdentity,
    label?: string
): Promise<PageEntity> {
    const page = await LogseqPropertiesHelper.getPage(pageIdentity);
    if (!page?.name)
        throw new Error(`${formatPageLabel(label)} not found: ${JSON.stringify(pageIdentity)}`);

    return page;
}

export async function requireActivePage(
    pageIdentity: PageIdentity,
    label?: string
): Promise<PageEntity> {
    const page = await requireExistingPage(pageIdentity, label);
    if (isPageSoftDeleted(page)) {
        throw new Error(`${formatPageLabel(label)} not found: ${JSON.stringify(pageIdentity)}`);
    }

    return page;
}