import type {BlockEntity, BlockIdentity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "./LogseqPropertiesHelper";

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

    static async getPreviousBlock(
        blockIdentity: BlockIdentity,
        opts: Partial<{parent: boolean}> = {}
    ): Promise<BlockEntity | PageEntity | null> {
        const previousSibling = await logseq.Editor.getPreviousSiblingBlock(blockIdentity);
        if (previousSibling) return previousSibling;
        if (!opts.parent) return null;

        const block = await logseq.Editor.getBlock(blockIdentity);
        if (!block?.parent) {
            throw new Error(`Block has no resolvable parent: ${JSON.stringify(blockIdentity)}`);
        }

        const parentBlock = await LogseqPropertiesHelper.getBlock(block.parent.id);
        if (!parentBlock?.uuid) {
            throw new Error(`Unable to resolve parent reference: ${block.parent.id}`);
        }

        if (logseq.Editor.isPageBlock(parentBlock)) {
            const parentPage = await LogseqPropertiesHelper.getPage(block.parent.id);
            if (!parentPage?.uuid) {
                throw new Error(`Unable to resolve parent page reference: ${block.parent.id}`);
            }
            return parentPage;
        }

        return parentBlock;
    }

    static async getWhetherPreviousBlockIsParent(blockIdentity: BlockIdentity): Promise<boolean> {
        const previousSibling = await logseq.Editor.getPreviousSiblingBlock(blockIdentity);
        return !previousSibling;
    }

    static async getNextBlock(
        blockIdentity: BlockIdentity,
        opts: Partial<{children: boolean}> = {}
    ): Promise<BlockEntity | null> {
        const block = await LogseqPropertiesHelper.getBlock(blockIdentity, {includeChildren: true});
        const firstChild = block?.children?.[0];
        if (Array.isArray(firstChild)) return await LogseqPropertiesHelper.getBlock(firstChild[1]);
        if (firstChild?.uuid) return firstChild as BlockEntity;
        if (opts.children) return null;

        return await logseq.Editor.getNextSiblingBlock(blockIdentity);
    }
}
