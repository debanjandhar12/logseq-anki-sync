import { BlockEntity, BlockIdentity, EntityID, PageEntity, PageIdentity } from "@logseq/libs/dist/LSPlugin";

/**
 * Helper class for fetching Logseq blocks and pages with properties attached.
 * 
 * In Logseq DB, properties are namespaced (e.g., :user.property/deck-bavZ5684)
 * and must be fetched separately via getBlockProperties/getPageProperties APIs.
 * This class handles fetching and property prefix stripping automatically.
 */
export class LogseqPropertiesHelper {
    private static stripPropertyPrefixes(properties: Record<string, any>): Record<string, any> {
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
        
        const properties = await logseq.Editor.getBlockProperties(block.uuid);
        if (properties) {
            const strippedProperties = this.stripPropertyPrefixes(properties);
            block.properties = { ...strippedProperties, ...block.properties };
        }
        
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