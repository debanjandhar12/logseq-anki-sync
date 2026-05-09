import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {LogseqAppInfoFetcher} from "./LogseqAppInfoFetcher";
import {LogseqProxy} from "./LogseqProxy";

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

    /**
     * Handles the tags property by merging user-defined tag properties with block / page tags.
     */
    public static handleTagProperty(
        entity: BlockEntity | PageEntity,
        properties: Record<string, any>
    ): Record<string, any> {
        if (!properties) return properties;

        const blockTags = properties[":block/tags"] || [];
        const propertyTags = properties.tags || [];

        let mergedTags: string[] = [];

        // Process user-defined tags (comma-separated string or array)
        if (propertyTags) {
            if (typeof propertyTags === "string") {
                mergedTags = propertyTags
                    .split(",")
                    .map((t: string) => t.trim())
                    .filter((t: string) => t);
            } else if (Array.isArray(propertyTags)) {
                mergedTags = [...propertyTags];
            }
        }

        // Add block tags
        if (Array.isArray(blockTags) && blockTags.length > 0) {
            mergedTags = [...mergedTags, ...blockTags];
        }

        // Return properties with merged tags (remove :block/tags key)
        const result = {...properties};
        delete result[":block/tags"];
        result.tags = mergedTags;

        // Populate tag ids - tag ids currently contain only block tags
        // Due to complexity, property tags are not added currently to tagIds
        result.tagIds = [];
        if (Array.isArray(entity.tags) && entity.tags.length > 0) {
            result.tagIds = entity.tags.map((t) => (typeof t === "object" && t.id ? t.id : t));
        }

        // validate output
        if (!Array.isArray(result.tags) || !result.tags.every((t) => typeof t === "string")) {
            throw new Error("LogseqPropertiesHelper failed to parse tag names....");
        }
        if (!Array.isArray(result.tagIds) || !result.tagIds.every((t) => typeof t === "number")) {
            throw new Error("LogseqPropertiesHelper failed to parse tag ids....");
        }

        return result;
    }

    /**
     * Removes properties prefixes such as :plugin.property.rw1zys138 from properties obj and add them to result property
     * Logseq DB adds such prefixes to properties. To maintain compatibility with file version of code, this needs to be done.
     * Note: This is inclusive, meaning old properties remain along with strippedProperties
     */
    public static addStripedPropertyPrefixes(properties: Record<string, any>): Record<string, any> {
        if (!properties) return properties;

        const strippedProperties: Record<string, any> = {};

        for (const [key, value] of Object.entries(properties)) {
            if (key === ":block/tags") continue; // skip block tags

            let cleanKey = key;
            if (key.startsWith(":")) {
                const lastSlash = key.lastIndexOf("/");
                if (lastSlash !== -1) {
                    const afterSlash = key.substring(lastSlash + 1);
                    // Only strip dash-suffix for :user.property/* (has random ID suffix)
                    if (key.startsWith(":user.property/")) {
                        const dashIndex = afterSlash.indexOf("-");
                        cleanKey =
                            dashIndex !== -1 ? afterSlash.substring(0, dashIndex) : afterSlash;
                    } else {
                        cleanKey = afterSlash;
                    }
                } else {
                    cleanKey = key.substring(1); // Remove leading colon
                }
            }

            strippedProperties[cleanKey] = value;
        }

        return {...properties, ...strippedProperties};
    }

    /**
     * Fetches and merges (inherits) properties from tags into the given entity.
     * Tag properties have lower priority - existing properties are not overwritten.
     * Also updates the entity's updatedAt to the max of current and tag updatedAt values.
     * Only applies to DB graphs.
     */
    private static async inheritTagProperties(
        entity: BlockEntity | PageEntity,
        tagIds: number[],
        isDbGraph: boolean
    ): Promise<void> {
        const settings = await LogseqProxy.Settings.getPluginSettings();
        if (!settings.inheritPropertiesFromTags) return;
        if (!isDbGraph || !tagIds || tagIds.length === 0) return;

        let maxUpdatedAt = entity.updatedAt || 0;

        for (const tagId of tagIds) {
            try {
                const tagPage = await logseq.Editor.getPage(tagId);
                if (!tagPage) continue;

                const tagProperties = await logseq.Editor.getPageProperties(tagId);
                if (tagProperties) {
                    const strippedTagProperties = LogseqPropertiesHelper.handleTagProperty(
                        entity,
                        LogseqPropertiesHelper.addStripedPropertyPrefixes(tagProperties)
                    );
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
            } catch (_e) {}
        }

        // Update entity's updatedAt to max value
        entity.updatedAt = maxUpdatedAt;
    }

    /**
     * Processes a block by fetching and attaching properties, and updating content for DB graphs
     */
    private static async processBlock(
        b: BlockEntity,
        isDbGraph: boolean,
        includeChildren: boolean = false
    ): Promise<void> {
        if (!b?.uuid) return;

        const properties = await logseq.Editor.getBlockProperties(b.uuid);
        if (properties) {
            b.properties = {
                ...LogseqPropertiesHelper.handleTagProperty(
                    b,
                    LogseqPropertiesHelper.addStripedPropertyPrefixes(properties)
                ),
                ...b.properties
            };
            if (b.properties["tags"] && typeof b.properties["tags"] === "string") {
                b.properties["tags"] = b.properties["tags"]
                    .split(",")
                    .map((t: string) => t.trim())
                    .filter((t: string) => t);
            }
            if (!b.properties.uuid) b.properties.uuid = b.uuid;
        }

        if (b.properties?.tags && Array.isArray(b.properties.tags)) {
            await LogseqPropertiesHelper.inheritTagProperties(b, b.properties.tagIds, isDbGraph);
        }

        if (isDbGraph) {
            const props = Object.entries(b.properties || {})
                .filter(([key]) => !key.startsWith("logseq.") && !key.startsWith("id"))
                .map(([key, value]) => {
                    const stringValue =
                        typeof value === "object" && value !== null ? JSON.stringify(value) : value;
                    return `${key}:: ${stringValue}`;
                })
                .join("\n");
            b.content = (props ? props + "\n" : "") + (b.content || "");
            b.content = `uuid:: ${b.uuid}\n` + b.content;
            if (_.get(b, "link.id")) {
                b.content = `link:: ${_.get(b, "link.id")}\n` + b.content;
                b.properties.link = _.get(b, "link.id");
            }
        }

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
                const strippedProperties = LogseqPropertiesHelper.handleTagProperty(
                    page,
                    LogseqPropertiesHelper.addStripedPropertyPrefixes(properties)
                );
                page.properties = {...strippedProperties, ...page.properties};
            }
        }

        if (page.properties?.tags && Array.isArray(page.properties.tags)) {
            await LogseqPropertiesHelper.inheritTagProperties(
                page,
                page.properties.tagIds,
                isDbGraph
            );
        }
    }

    /**
     * Fetches a block with properties attached (non-cached, fresh data)
     */
    static async getBlock(
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
    static async getPage(srcPage: PageIdentity | EntityID): Promise<PageEntity | null> {
        const page: PageEntity | null = await logseq.Editor.getPage(srcPage);

        if (!page) return null;

        const isDbGraph = await LogseqPropertiesHelper.checkCurrentIsDbGraph();
        await LogseqPropertiesHelper.processPage(page, isDbGraph);

        return page;
    }

    /**
     * Fetches page blocks tree with properties attached (non-cached, fresh data)
     */
    static async getPageBlocksTree(srcPage: PageIdentity | EntityID): Promise<BlockEntity[]> {
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

/**
 * Proxy version that uses cached LogseqProxy.App.checkCurrentIsDbGraph.
 * Use this when working within the sync system where caching is beneficial.
 */
export class LogseqPropertiesHelperProxy extends LogseqPropertiesHelper {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return Boolean(await LogseqProxy.App.checkCurrentIsDbGraph());
    }
}
