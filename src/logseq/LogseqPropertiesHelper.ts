import { BlockEntity, BlockIdentity, EntityID, PageEntity, PageIdentity } from "@logseq/libs/dist/LSPlugin";

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
        
        const isDbGraph = await logseq.App.checkCurrentIsDbGraph();
        
        const processBlock = async (b: BlockEntity) => {
            if (!b || !b.uuid) return;
            // Fetch and add properties for parent block and children when includeChildren is true
            const properties = await logseq.Editor.getBlockProperties(b.uuid);
            if (properties) {
                b.properties = { ...this.stripPropertyPrefixes(properties), ...b.properties };
            }
            // For db graphs, add properties and tags to content for parent block and children
            // This is to maintain backward compatibility with markdown version.
            if (isDbGraph) {
                const props = Object.entries(b.properties || {})
                    .filter(([key]) => !key.startsWith('logseq.') && !key.startsWith('id'))
                    .map(([key, value]) => `${key}:: ${value}`).join('\n');
                const tags = (b.properties?.tags || []).map(tag => `#[[${tag}]]`).join(' ');
                b.content = (props ? props + '\n' : '') + (b.content || '') + (tags ? ' ' + tags : '');
            }
            if (b.children && opts.includeChildren) {
                for (const child of b.children) await processBlock(child as BlockEntity);
            }
        };
        await processBlock(block);
        
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
        let page: PageEntity | null = null;
        
        if (typeof srcPage === "number") {
            page = await logseq.Editor.getPage(srcPage);
            if (!page) return null;
            page = await logseq.Editor.getPage(page.name);
        } else {
            page = await logseq.Editor.getPage(srcPage);
        }
        
        if (!page) return null;
        
        const properties = await logseq.Editor.getPageProperties(page.name);
        if (properties) {
            const strippedProperties = this.stripPropertyPrefixes(properties);
            page.properties = { ...strippedProperties, ...page.properties };
        }
        
        return page;
    }
}