import type {BlockEntity, BlockIdentity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {validatePropertyUuidOrIndent} from "src/core/logseq-reversible-transaction-tracker/commands/utils/validations/propertyValidations";
import {LogseqPropertiesHelper} from "./LogseqPropertiesHelper";

export class LogseqEditor {
    static async getCurrentPage(): Promise<PageEntity | null> {
        const currentPage = await logseq.Editor.getCurrentPage();
        return currentPage as PageEntity;
    }

    static async getProperty(
        propertyUuidOrIndent: string
    ): Promise<Awaited<ReturnType<typeof logseq.Editor.getProperty>>> {
        propertyUuidOrIndent = validatePropertyUuidOrIndent(propertyUuidOrIndent);

        const propertyBlock = await logseq.Editor.getBlock(propertyUuidOrIndent);
        const propertyIndent = propertyBlock
            ? LogseqEditor.getPropertyIndentFromEntity(propertyBlock)
            : propertyUuidOrIndent;

        if (!propertyIndent) return null;
        return await logseq.Editor.getProperty(propertyIndent);
    }

    private static getPropertyIndentFromEntity(
        property: BlockEntity | PageEntity
    ): string | undefined {
        const record = property as unknown as Record<string, unknown>;
        const ident = record.ident ?? record["db/ident"] ?? record[":db/ident"];
        if (typeof ident === "string" && ident.includes("/")) {
            return ident.replace(/^:/, "").split("/").at(-1);
        }

        if (typeof ident === "string" && ident.trim()) return ident;

        return undefined;
    }

    static async isTagBlock(blockOrUuid: BlockEntity | PageEntity | string): Promise<boolean> {
        const uuid = typeof blockOrUuid === "string" ? blockOrUuid : blockOrUuid.uuid;
        if (!uuid) return false;

        try {
            return Boolean(await logseq.Editor.getTag(uuid));
        } catch {
            return false;
        }
    }

    static async isPropertyBlock(blockOrUuid: BlockEntity | PageEntity | string): Promise<boolean> {
        const block =
            typeof blockOrUuid === "string"
                ? await logseq.Editor.getBlock(blockOrUuid)
                : blockOrUuid;

        if (!block) return false;
        if ("type" in block && block.type === "property") return true;
        return Boolean(block.ident);
    }

    static async getCurrentEditingBlock(): Promise<BlockEntity | null> {
        const blockUUID = await logseq.Editor.checkEditing();

        if (typeof blockUUID !== "string") return null;

        return await logseq.Editor.getBlock(blockUUID);
    }

    static async updateBlock(srcBlock: BlockIdentity | EntityID, content: string): Promise<void> {
        await logseq.Editor.updateBlock(srcBlock, content);
    }

    static async isPageBlock(block: BlockEntity | PageEntity): Promise<boolean> {
        try {
            // @ts-ignore The await is required. DO NOT REMOVE!
            return Boolean(await logseq.Editor.isPageBlock(block));
        } catch {
            // Fallback required for test mode (logseq http server doesnt support isPageBlock)
            const blockById = await logseq.Editor.getBlock(block.id);
            return blockById?.page?.id === block.id;
        }
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

        if (await LogseqEditor.isPageBlock(parentBlock)) {
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
