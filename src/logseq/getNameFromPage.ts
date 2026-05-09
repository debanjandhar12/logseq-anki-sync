import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

export default function getNameFromPage(page: PageEntity): string {
    return (
        page?.originalName ||
        (page?.fullTitle as string | null) ||
        page?.title ||
        page?.name ||
        null
    );
}
