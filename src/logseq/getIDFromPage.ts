import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

/**
 * Get ID from page entity
 * @param page
 */
export default function getIDFromPage(page: PageEntity): number {
    return page?.id || null;
}
