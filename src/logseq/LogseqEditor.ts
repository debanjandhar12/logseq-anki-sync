import type {BlockEntity, BlockIdentity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";

export class LogseqEditor {
    static async getCurrentPage(): Promise<PageEntity | null> {
        const currentPage = await logseq.Editor.getCurrentPage();
        return currentPage as PageEntity;
    }

    static async getCurrentEditingBlock(): Promise<BlockEntity | null> {
        const blockUUID = await logseq.Editor.checkEditing();

        if (typeof blockUUID !== "string") return null;

        return await logseq.Editor.getBlock(blockUUID);
    }

    static async updateBlock(srcBlock: BlockIdentity | EntityID, content: string): Promise<void> {
        await logseq.Editor.updateBlock(srcBlock, content);
    }
}
