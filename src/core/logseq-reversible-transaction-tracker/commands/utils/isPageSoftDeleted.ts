import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

export function isPageSoftDeleted(page: PageEntity): boolean {
    return page[":logseq.property/deleted-at" as keyof PageEntity] != null;
}
