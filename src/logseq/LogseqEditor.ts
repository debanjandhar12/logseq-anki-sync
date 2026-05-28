import type {BlockIdentity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";

export class LogseqEditor {
    static async getCurrentPage(): Promise<PageEntity | null> {
        const currentPage = await logseq.Editor.getCurrentPage();

        if (currentPage?.type !== "page") return null;

        return currentPage as PageEntity;
    }

    static async updateBlock(srcBlock: BlockIdentity | EntityID, content: string): Promise<void> {
        await logseq.Editor.updateBlock(srcBlock, content);
    }
}
