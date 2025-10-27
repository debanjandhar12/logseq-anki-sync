import {PageEntity} from "@logseq/libs/dist/LSPlugin";

export default function getNameFromPage(page: PageEntity): string {
    return (
        page?.originalName ||
        page?.name ||
        null
    );
}
