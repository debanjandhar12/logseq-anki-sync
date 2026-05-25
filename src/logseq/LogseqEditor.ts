import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

export class LogseqEditor {
    static async getCurrentPage(): Promise<PageEntity | null> {
        const currentPage = await logseq.Editor.getCurrentPage();

        if (currentPage?.type !== "page") return null;

        return currentPage as PageEntity;
    }
}
