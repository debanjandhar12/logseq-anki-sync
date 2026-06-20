import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

export function isDeletedPage(page: PageEntity): boolean {
    return page[":logseq.property/deleted-at" as keyof PageEntity] != null;
}
