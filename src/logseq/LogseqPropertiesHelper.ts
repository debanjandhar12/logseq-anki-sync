import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import {LogseqAppInfoFetcher} from "./LogseqAppInfoFetcher";

/**
 * Helper class for fetching Logseq blocks and pages with properties attached.
 *
 */
export class LogseqPropertiesHelper {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return await LogseqAppInfoFetcher.checkCurrentIsDbGraph();
    }

    /**
     * Processes a block by fetching and attaching properties.
     */
    private static async processBlock(
        b: BlockEntity,
        isDbGraph: boolean,
        includeChildren: boolean = false
    ): Promise<void> {
        if (!b?.uuid) return;

        const properties = await logseq.Editor.getBlockProperties(b.uuid);
        if (properties) {
            b.properties = {...properties, ...b.properties};
        }

        b.properties = {...b.properties, uuid: b.properties?.uuid ?? b.uuid};

        if (b.children && includeChildren) {
            for (const child of b.children) {
                await LogseqPropertiesHelper.processBlock(
                    child as BlockEntity,
                    isDbGraph,
                    includeChildren
                );
            }
        }
    }

    /**
     * Processes a page by fetching and attaching properties
     */
    private static async processPage(page: PageEntity, isDbGraph: boolean): Promise<void> {
        if (!page) return;

        if (isDbGraph) {
            const properties = await logseq.Editor.getPageProperties(page.id);
            if (properties) {
                page.properties = {...properties, ...page.properties};
            }
        }

        page.properties = {...page.properties, uuid: page.properties?.uuid ?? page.uuid};
    }

    /**
     * Fetches a block with properties attached (non-cached, fresh data)
     */
    public static async getBlock(
        srcBlock: BlockIdentity | EntityID,
        opts: Partial<{includeChildren: boolean}> = {}
    ): Promise<BlockEntity | null> {
        const block = await logseq.Editor.getBlock(srcBlock, opts);
        if (!block) return null;

        const isDbGraph = await LogseqPropertiesHelper.checkCurrentIsDbGraph();
        await LogseqPropertiesHelper.processBlock(block, isDbGraph, opts.includeChildren);

        return block;
    }

    /**
     * Fetches a page with properties attached (non-cached, fresh data)
     */
    public static async getPage(srcPage: PageIdentity | EntityID): Promise<PageEntity | null> {
        const page: PageEntity | null = await logseq.Editor.getPage(srcPage);

        if (!page) return null;

        const isDbGraph = await LogseqPropertiesHelper.checkCurrentIsDbGraph();
        await LogseqPropertiesHelper.processPage(page, isDbGraph);

        return page;
    }

    /**
     * Fetches page blocks tree with properties attached (non-cached, fresh data)
     */
    public static async getPageBlocksTree(srcPage: PageIdentity | EntityID): Promise<BlockEntity[]> {
        const page = await logseq.Editor.getPage(srcPage);
        srcPage = page.uuid; // Convert to page uuid for getPageBlocksTree

        const blocks = await logseq.Editor.getPageBlocksTree(srcPage);
        if (!blocks) return [];

        const isDbGraph = await LogseqPropertiesHelper.checkCurrentIsDbGraph();

        for (const block of blocks) {
            await LogseqPropertiesHelper.processBlock(block as BlockEntity, isDbGraph, true);
        }

        return blocks;
    }
}
