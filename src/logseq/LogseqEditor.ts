import type {BlockEntity, BlockIdentity, EntityID, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "./LogseqPropertiesHelper";

type MetadataEntity = BlockEntity | PageEntity;
type MetadataEntityWithPropertyIdent = MetadataEntity & {
    "db/ident"?: unknown;
    ":db/ident"?: unknown;
};

export class LogseqEditor {
    private static getUuid(entityOrUuid: MetadataEntity | string): string | null {
        if (typeof entityOrUuid === "string") return entityOrUuid;
        return typeof entityOrUuid.uuid === "string" ? entityOrUuid.uuid : null;
    }

    private static async getMetadataEntity(
        entityOrUuid: MetadataEntity | string
    ): Promise<MetadataEntity | null> {
        if (typeof entityOrUuid !== "string") return entityOrUuid;

        const getBlockWithPageFallback = logseq.Editor.getBlock as unknown as (
            srcBlock: BlockIdentity | EntityID,
            opts?: Partial<{includeChildren: boolean; includePage: boolean}>
        ) => Promise<MetadataEntity | null>;

        const block = await getBlockWithPageFallback(entityOrUuid, {includePage: true});
        if (block) return block;

        return await logseq.Editor.getPage(entityOrUuid);
    }

    private static getPropertyKeyCandidates(entity: MetadataEntity | null): string[] {
        if (!entity) return [];

        const entityWithIdent = entity as MetadataEntityWithPropertyIdent & Record<string, unknown>;
        const candidates = [
            entityWithIdent.ident,
            entityWithIdent["db/ident"],
            entityWithIdent[":db/ident"],
            entityWithIdent.name,
            entityWithIdent.originalName,
            entityWithIdent.title,
            entityWithIdent.content
        ];

        return candidates.filter(
            (candidate): candidate is string =>
                typeof candidate === "string" && candidate.length > 0
        );
    }

    private static async resolveProperty(
        entityOrUuid: MetadataEntity | string
    ): Promise<Awaited<ReturnType<typeof logseq.Editor.getProperty>>> {
        const entity = await LogseqEditor.getMetadataEntity(entityOrUuid);
        const uuid =
            LogseqEditor.getUuid(entityOrUuid) || (entity ? LogseqEditor.getUuid(entity) : null);

        for (const propertyKey of LogseqEditor.getPropertyKeyCandidates(entity)) {
            const property = await logseq.Editor.getProperty(propertyKey);
            if (!property) continue;
            if (uuid && property.uuid && property.uuid !== uuid) continue;
            return property;
        }

        return null;
    }

    static async getCurrentPage(): Promise<PageEntity | null> {
        const currentPage = await logseq.Editor.getCurrentPage();
        return currentPage as PageEntity;
    }

    static async getProperty(
        propertyPageUuid: string
    ): Promise<Awaited<ReturnType<typeof logseq.Editor.getProperty>>> {
        return await LogseqEditor.resolveProperty(propertyPageUuid);
    }

    static async isTagBlock(blockOrUuid: MetadataEntity | string): Promise<boolean> {
        const uuid = LogseqEditor.getUuid(blockOrUuid);
        if (!uuid) return false;

        try {
            return Boolean(await logseq.Editor.getTag(uuid));
        } catch {
            return false;
        }
    }

    static async isPropertyBlock(blockOrUuid: MetadataEntity | string): Promise<boolean> {
        try {
            return Boolean(await LogseqEditor.resolveProperty(blockOrUuid));
        } catch {
            return false;
        }
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
