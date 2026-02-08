import { BlockEntity, BlockIdentity, EntityID, PageEntity, PageIdentity } from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import getNameFromPage from "./getNameFromPage";
import {LogseqAppInfoFetcher} from "./LogseqAppInfoFetcher";
import {LogseqProxy} from "./LogseqProxy";
import getIDFromPage from "./getIDFromPage";

/**
 * Helper class for fetching Logseq blocks and pages with properties attached.
 * 
 * In Logseq DB, properties are namespaced (e.g., :user.property/deck-bavZ5684)
 * and must be fetched separately via getBlockProperties/getPageProperties APIs.
 * This class handles fetching and property prefix stripping automatically.
 * It also appends properties and tags inside content of blocks so that
 * content behavior is similar to non db version.
 */
export class LogseqPropertiesHelper {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return await LogseqAppInfoFetcher.checkCurrentIsDbGraph();
    }

    public static stripPropertyPrefixes(properties: Record<string, any>): Record<string, any> {
        if (!properties) return properties;
        
        const strippedProperties: Record<string, any> = {};
        let blockTags: string[] | null = null;
        
        for (const [key, value] of Object.entries(properties)) {
            // Special handling for :block/tags - save for merging with user tags
            if (key === ":block/tags") {
                blockTags = Array.isArray(value) ? value : [];
                continue;
            }

            let cleanKey = key;
            if (key.startsWith(":")) {
                const lastSlash = key.lastIndexOf("/");
                if (lastSlash !== -1) {
                    const afterSlash = key.substring(lastSlash + 1);
                    // Only strip dash-suffix for :user.property/* (has random ID suffix)
                    if (key.startsWith(":user.property/")) {
                        const dashIndex = afterSlash.indexOf("-");
                        cleanKey = dashIndex !== -1 ? afterSlash.substring(0, dashIndex) : afterSlash;
                    } else {
                        cleanKey = afterSlash;
                    }
                } else {
                    cleanKey = key.substring(1); // Remove leading colon
                }
            }
            
            strippedProperties[cleanKey] = value;
        }
        
        // Merge tags from properties as well as content tags
        if (strippedProperties.tags || blockTags) {
            let mergedTags: string[] = [];
            
            // Split user-defined tags (comma-separated string)
            if (strippedProperties.tags) {
                if (typeof strippedProperties.tags === "string") {
                    mergedTags = strippedProperties.tags.split(",").map((t: string) => t.trim()).filter((t: string) => t);
                } else if (Array.isArray(strippedProperties.tags)) {
                    mergedTags = [...strippedProperties.tags];
                }
            }
            
            // Add block tags
            if (blockTags && blockTags.length > 0) {
                mergedTags = [...mergedTags, ...blockTags];
            }
            
            strippedProperties.tags = mergedTags;
        }
        
        return strippedProperties;
    }

    /**
     * Fetches and merges (inherits) properties from tags into the given entity.
     * Tag properties have lower priority - existing properties are not overwritten.
     * Also updates the entity's updatedAt to the max of current and tag updatedAt values.
     * Only applies to DB graphs.
     * 
     * @param entity - The block or page entity to merge tag properties into
     * @param tags - Array of tag names to fetch properties from
     * @param isDbGraph - Whether the current graph is a DB graph
     */
    private static async inheritTagProperties(entity: BlockEntity | PageEntity, tags: string[], isDbGraph: boolean): Promise<void> {
        const settings = await LogseqProxy.Settings.getPluginSettings();
        if (!settings.inheritPropertiesFromTags) return;
        if (!isDbGraph || !tags || tags.length === 0) return;
        
        let maxUpdatedAt = entity.updatedAt || 0;
        
        for (const tagName of tags) {
            try {
                const tagPage = await logseq.Editor.getPage(tagName);
                if (!tagPage) continue;
                
                const tagProperties = await logseq.Editor.getPageProperties(tagName);
                if (tagProperties) {
                    const strippedTagProperties = this.stripPropertyPrefixes(tagProperties);
                    // Merge without overwriting existing properties
                    for (const [key, value] of Object.entries(strippedTagProperties)) {
                        if (!(key in entity.properties)) {
                            entity.properties[key] = value;
                        }
                    }
                }
                
                // Track max updatedAt
                if (tagPage.updatedAt && tagPage.updatedAt > maxUpdatedAt) {
                    maxUpdatedAt = tagPage.updatedAt;
                }
            } catch (error) {}
        }
        
        // Update entity's updatedAt to max value
        entity.updatedAt = maxUpdatedAt;
    }

    /**
     * Processes a block by fetching and attaching properties, and updating content for DB graphs
     */
    private static async processBlock(b: BlockEntity, isDbGraph: boolean, includeChildren: boolean = false): Promise<void> {
        if (!b || !b.uuid) return;
        
        const properties = await logseq.Editor.getBlockProperties(b.uuid);
        if (properties) {
            b.properties = { ...this.stripPropertyPrefixes(properties), ...b.properties };
            if (b.properties["tags"] && typeof b.properties["tags"] === "string") {
                b.properties["tags"] = b.properties["tags"].split(",").map((t: string) => t.trim()).filter((t: string) => t);
            }
            if (!b.properties.uuid) b.properties.uuid = b.uuid;
        }
        
        if (b.properties?.tags && Array.isArray(b.properties.tags)) {
            await this.inheritTagProperties(b, b.properties.tags, isDbGraph);
        }
        
        if (isDbGraph) {
            const props = Object.entries(b.properties || {})
                .filter(([key]) => !key.startsWith('logseq.') && !key.startsWith('id'))
                .map(([key, value]) => {
                    const stringValue = typeof value === 'object' && value !== null 
                        ? JSON.stringify(value) 
                        : value;
                    return `${key}:: ${stringValue}`;
                }).join('\n');
            b.content = (props ? props + '\n' : '') + (b.content || '');
            b.content = `uuid:: ${b.uuid}\n` + b.content;
            if (_.get(b, 'link.id')) {
                b.content = `link:: ${_.get(b, 'link.id')}\n` + b.content;
                b.properties.link = _.get(b, 'link.id');
            }
        }
        
        if (b.children && includeChildren) {
            for (const child of b.children) {
                await this.processBlock(child as BlockEntity, isDbGraph, includeChildren);
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
                const strippedProperties = this.stripPropertyPrefixes(properties);
                page.properties = { ...strippedProperties, ...page.properties };
            }
        }
        
        if (page.properties?.tags && Array.isArray(page.properties.tags)) {
            await this.inheritTagProperties(page, page.properties.tags, isDbGraph);
        }
    }

    /**
     * Fetches a block with properties attached (non-cached, fresh data)
     *
     * @param srcBlock - Block UUID or entity ID
     * @param opts - Options for fetching (includeChildren)
     * @returns Block with properties attached, or null if not found
     */
    static async getBlock(
        srcBlock: BlockIdentity | EntityID,
        opts: Partial<{includeChildren: boolean}> = {}
    ): Promise<BlockEntity | null> {
        const block = await logseq.Editor.getBlock(srcBlock, opts);
        if (!block) return null;

        const isDbGraph = await this.checkCurrentIsDbGraph();
        await this.processBlock(block, isDbGraph, opts.includeChildren);
        
        return block;
    }

    /**
     * Fetches a page with properties attached (non-cached, fresh data)
     * 
     * @param srcPage - Page name or entity ID
     * @returns Page with properties attached, or null if not found
     */
    static async getPage(
        srcPage: PageIdentity | EntityID
    ): Promise<PageEntity | null> {
        let page: PageEntity | null = await logseq.Editor.getPage(srcPage);
        
        if (!page) return null;

        const isDbGraph = await this.checkCurrentIsDbGraph();
        await this.processPage(page, isDbGraph);

        return page;
    }

    /**
     * Fetches page blocks tree with properties attached (non-cached, fresh data)
     * 
     * @param srcPage - Page name or entity ID
     * @returns Array of blocks with properties attached
     */
    static async getPageBlocksTree(
        srcPage: PageIdentity | EntityID
    ): Promise<BlockEntity[]> {
        const page = await logseq.Editor.getPage(srcPage);
        srcPage = page.uuid; // Convert to page uuid for getPageBlocksTree
        
        const blocks = await logseq.Editor.getPageBlocksTree({uuid: srcPage as string});
        if (!blocks) return [];

        const isDbGraph = await this.checkCurrentIsDbGraph();

        for (const block of blocks) {
            await this.processBlock(block as BlockEntity, isDbGraph, true);
        }
        
        return blocks;
    }
}

/**
 * Proxy version that uses cached LogseqProxy.App.checkCurrentIsDbGraph.
 * Use this when working within the sync system where caching is beneficial.
 */
export class LogseqPropertiesHelperProxy extends LogseqPropertiesHelper {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return Boolean(await LogseqProxy.App.checkCurrentIsDbGraph());
    }
}
