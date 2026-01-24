import "@logseq/libs";
import {EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import pMemoize, {pMemoizeClear} from "p-memoize";
import objectHashOptimized from "../utils/objectHashOptimized";
import {
    LOGSEQ_EMBDED_PAGE_REGEXP,
    LOGSEQ_PAGE_REF_REGEXP,
    LOGSEQ_RENAMED_PAGE_REF_REGEXP,
    MD_PROPERTIES_REGEXP,
    ORG_PROPERTIES_REGEXP,
} from "../constants";
import {safeReplace, safeReplaceAsync} from "../utils/utils";
import getNameFromPage from "./getNameFromPage";
import getUUIDFromBlock from "./getUUIDFromBlock";

/**
 * INTERNAL FORMAT SPECIFICATION
 * ==============================
 * 
 * LogseqContentPreprocessor normalizes Logseq content from different graph formats
 * (DB mode, Markdown, Org-mode) into a standardized internal representation before
 * HTML conversion. This acts as a backward compatibility layer.
 * 
 * WHY THIS EXISTS:
 * Logseq supports three graph formats with different syntax:
 * 1. DB Mode (0.2.3+) - Uses UUIDs, namespaced properties
 * 2. Markdown Mode - File-based with markdown syntax
 * 3. Org Mode - File-based with org-mode syntax
 * 
 * INTERNAL FORMAT TARGET:
 * 
 * 1. PAGE REFERENCES: [[page-uuid]]
 *    - All page names are resolved to their UUID equivalents
 *    - Example: [[My Page]] → [[65f3a2b1-4c8d-4e9a-8f2b-1a2b3c4d5e6f]]
 *    - Rationale: UUIDs are stable across renames, work in all graph modes
 * 
 * 2. PAGE EMBEDS: {{embed [[page-uuid]]}}
 *    - Page names in embeds are resolved to UUIDs
 *    - Example: {{embed [[My Page]]}} → {{embed [[65f3a2b1-...]]}}
 *    - Rationale: Consistent with page references, enables dependency tracking
 * 
 * 3. RENAMED PAGE REFERENCES: [alias]([[page-uuid]])
 *    - Alias text is preserved, page name resolved to UUID
 *    - Example: [My Alias]([[My Page]]) → [My Alias]([[65f3a2b1-...]])
 *    - Rationale: Display name stays user-friendly, link is stable
 * 
 * 4. BLOCK REFERENCES (DB MODE SPECIAL CASE): ((block-uuid))
 *    - In DB mode, [[uuid-string]] might actually be a block reference
 *    - Checks if 36-character UUID string is a block, converts to ((uuid))
 *    - Example: [[65f3a2b1-4c8d-...]] → ((65f3a2b1-4c8d-...))
 *    - Rationale: DB mode uses [[]] for both pages and blocks, need to disambiguate
 * 
 * 5. PROPERTIES: Extracted and removed from content
 *    - Markdown: "key:: value" lines → Removed, stored in properties object
 *    - Org: ":PROPERTIES:...:END:" blocks → Removed, stored in properties object
 *    - Example: "deck:: MyDeck\nContent" → content="Content", properties={deck: "MyDeck"}
 *    - Rationale: Properties are metadata, not content for display
 * 
 * 6. PDF ANNOTATIONS
 * 
 * 7. ASSET BACKWARD COMPATIBILITY (DB MODE):
 *    - Blocks with tags:["asset"] + type + uuid properties
 *    - Converts to: ![](../assets/{uuid}.{type}){:width "..." :height "..."}
 *    - Example: tags:["asset"], type:"png", uuid:"abc123"
 *              → ![](../assets/abc123.png)
 *    - Rationale: DB mode stores assets as blocks, need markdown representation
 * 
 * 8. NODE EMBED BACKWARD COMPATIBILITY (DB MODE):
 *    - Blocks with link property (DB ID)
 *    - Converts to: {{embed ((block-uuid))}} or {{embed [[page-uuid]]}}
 *    - Example: link:12345 → {{embed ((65f3a2b1-...))}}
 *    - Rationale: DB mode uses link property for embeds, need standard syntax
 */

export interface PreprocessResult {
    content: string;
    properties: Record<string, any>;
}

export class LogseqContentPreprocessor {
    /**
     * Preprocesses Logseq content from any format (DB/MD/Org) to internal format.
     * 
     * @param content - Raw Logseq block content
     * @param format - Source format: "markdown" or "org"
     * @returns Normalized content and extracted properties
     */
    static async preprocess(
        content: string,
        format: "markdown" | "org" = "markdown"
    ): Promise<PreprocessResult> {
        let resultContent = content;
        let properties: Record<string, any> = {};

        // Step 1: Extract and remove properties
        [resultContent, properties] = this.extractProperties(resultContent, format);

        // Step 2: Normalize page embeds to use UUIDs
        resultContent = await this.normalizePageEmbeds(resultContent);

        // Step 3: Normalize page references to use UUIDs
        resultContent = await this.normalizePageReferences(resultContent, format);

        // Step 4: Normalize renamed page references to use UUIDs
        resultContent = await this.normalizeRenamedPageReferences(resultContent);

        // Step 5: Apply PDF annotation formatting
        resultContent = await this.applyPdfAnnotations(resultContent, properties);

        // Step 6: Apply backward compatibility transformations (DB mode)
        resultContent = await this.applyBackwardCompatibility(resultContent, properties);

        return {content: resultContent, properties};
    }

    /**
     * Extracts properties from content and removes them.
     * Handles both Markdown (key:: value) and Org (:PROPERTIES:) formats.
     */
    private static extractProperties(
        content: string,
        format: "markdown" | "org"
    ): [string, Record<string, any>] {
        let resultContent = content;
        const properties: Record<string, any> = {};

        // Remove org properties
        resultContent = safeReplace(resultContent, ORG_PROPERTIES_REGEXP, "");

        // Extract and remove markdown properties
        resultContent = safeReplace(resultContent, MD_PROPERTIES_REGEXP, (match) => {
            const [key, value] = match.split("::");
            if (key && value) {
                properties[key.trim()] = value.trim();
            }
            return "";
        });

        return [resultContent, properties];
    }

    /**
     * Normalizes page embeds to use UUIDs instead of page names.
     * Example: {{embed [[My Page]]}} → {{embed [[page-uuid]]}}
     */
    private static async normalizePageEmbeds(content: string): Promise<string> {
        return await safeReplaceAsync(
            content,
            LOGSEQ_EMBDED_PAGE_REGEXP,
            async (match, pageName) => {
                try {
                    const page = await this.getPage(pageName);
                    if (page) {
                        const uuid = getUUIDFromBlock(page);
                        if (uuid) {
                            return match.replace(pageName, uuid);
                        }
                    }
                } catch (e) {
                    // Page not found, keep original
                }
                return match;
            }
        );
    }

    /**
     * Normalizes page references to use UUIDs instead of page names.
     * Also handles DB mode special case where [[uuid]] might be a block reference.
     * Example: [[My Page]] → [[page-uuid]]
     * DB mode: [[block-uuid]] → ((block-uuid))
     */
    private static async normalizePageReferences(
        content: string,
        format: "markdown" | "org"
    ): Promise<string> {
        return await safeReplaceAsync(
            content,
            LOGSEQ_PAGE_REF_REGEXP,
            async (match, pageName) => {
                // Handle org mode special cases (images and URLs)
                if (format === "org") {
                    const encodedName = encodeURI(pageName);
                    if (encodedName.match(/\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)(\?.*)?$/i)) {
                        return `![](${pageName})`; // This is actually an image
                    }
                    if (encodedName.match(/^(https?:\/\/)/i)) {
                        return pageName; // This is actually a web URL
                    }
                }

                // DB mode special case: Check if [[uuid]] is actually a block reference
                if (await this.checkCurrentIsDbGraph()) {
                    if (pageName.length === 36) {
                        // Might be a UUID
                        const possibleBlock = await this.getBlock(pageName);
                        if (possibleBlock) {
                            return `((${possibleBlock.uuid}))`; // Convert to block ref
                        }
                    }
                }

                // Standard case: Convert page name to UUID
                try {
                    const page = await this.getPage(pageName);
                    if (page) {
                        const uuid = getUUIDFromBlock(page);
                        if (uuid) {
                            return `[[${uuid}]]`;
                        }
                    }
                } catch (e) {
                    // Page not found, keep original
                }

                return `[[${pageName}]]`;
            }
        );
    }

    /**
     * Normalizes renamed page references to use UUIDs.
     * Example: [My Alias]([[My Page]]) → [My Alias]([[page-uuid]])
     */
    private static async normalizeRenamedPageReferences(content: string): Promise<string> {
        return await safeReplaceAsync(
            content,
            LOGSEQ_RENAMED_PAGE_REF_REGEXP,
            async (match, aliasContent, pageName) => {
                try {
                    const page = await this.getPage(pageName);
                    if (page) {
                        const uuid = getUUIDFromBlock(page);
                        if (uuid) {
                            return `[${aliasContent}]([[${uuid}]])`;
                        }
                    }
                } catch (e) {
                    // Page not found, keep original
                }
                return match;
            }
        );
    }

    /**
     * Applies PDF annotation formatting based on properties.
     * Prepends visual indicators and page numbers to annotation content.
     */
    private static async applyPdfAnnotations(
        content: string,
        properties: Record<string, any>
    ): Promise<string> {
        // Normalize property names (support both camelCase and kebab-case)
        const lsType = properties["ls-type"] || properties["lsType"];
        const hlType = properties["hl-type"] || properties["hlType"];
        const hlPage = properties["hl-page"] || properties["hlPage"];
        const hlStamp = properties["hl-stamp"] || properties["hlStamp"];
        const hlColor = properties["hl-color"] || properties["hlColor"];

        // Color symbol mapping
        const annotationSymbolMap: Record<string, string> = {
            yellow: "🟡",
            green: "🟢",
            blue: "�",
            red: "🔴",
            purple: "🟣",
        };

        if (lsType === "annotation" && hlType === "area") {
            // Image annotation
            const blockUuid = properties["id"] || properties["nid"] || properties["uuid"];
            const block = await this.getBlock(blockUuid);
            let hlsImgLoc = "error";

            try {
                if (_.get(block, [":logseq.property.pdf/hl-image", "id"])) {
                    // DB graphs
                    const assetBlock = await this.getBlock(
                        _.get(block, [":logseq.property.pdf/hl-image", "id"])
                    );
                    if (assetBlock) {
                        hlsImgLoc = `../assets/${assetBlock.uuid}.${assetBlock.properties.type}?imageAnnotationBlockUUID=${blockUuid}`;
                    }
                } else {
                    // MD graphs
                    const page = await this.getPage(block?.page?.id as number | PageIdentity);
                    if (page) {
                        hlsImgLoc = `../assets/${(getNameFromPage(page) ?? "").replace(
                            "hls__",
                            ""
                        )}/${hlPage}_${blockUuid}_${hlStamp}.png?imageAnnotationBlockUUID=${blockUuid}`;
                    }
                }

                const symbol = annotationSymbolMap[hlColor] || "📌";
                return `${symbol}**P${hlPage}** <div></div> ![](${hlsImgLoc})\n${content}`;
            } catch (e) {
                console.warn(e);
            }
        } else if (lsType === "annotation") {
            // Text annotation
            try {
                const symbol = annotationSymbolMap[hlColor] || "📌";
                return `${symbol}**P${hlPage}** ${content}`;
            } catch (e) {
                console.warn(e);
            }
        }

        return content;
    }

    /**
     * Applies backward compatibility transformations for DB mode.
     * Handles asset blocks and node embed blocks.
     */
    private static async applyBackwardCompatibility(
        content: string,
        properties: Record<string, any>
    ): Promise<string> {
        let resultContent = content;

        // Asset backward compatibility
        const tagsStr = _.get(properties, "tags", "[]");
        let tags: string[] = [];
        try {
            tags = JSON.parse(tagsStr);
        } catch (e) {
            console.warn(e);
        }

        const type = _.get(properties, "type", "");
        const uuid = _.get(properties, "uuid", "");
        const hasAssetTag =
            _.isArray(tags) && tags.map((t) => t.trim().toLowerCase()).includes("asset");

        if (hasAssetTag && !_.isEmpty(type) && !_.isEmpty(uuid)) {
            let assetMarkdown = `![](../assets/${uuid}.${type})`;

            // Add resize metadata if present
            const resizeMeta = _.get(properties, "resize-metadata");
            let resizeMetaObj: Record<string, any> = {};
            try {
                resizeMetaObj = JSON.parse(resizeMeta);
            } catch (e) {
                console.warn(e);
            }

            if (_.isPlainObject(resizeMetaObj)) {
                const width = _.get(resizeMetaObj, "width", 0);
                const height = _.get(resizeMetaObj, "height", 0);
                const metaParts: string[] = [];

                if (_.isNumber(width) && width > 0) {
                    metaParts.push(`:width "${width}"`);
                }
                if (_.isNumber(height) && height > 0) {
                    metaParts.push(`:height "${height}"`);
                }

                if (metaParts.length > 0) {
                    assetMarkdown += `{${metaParts.join(" ")}}`;
                }
            }

            resultContent = assetMarkdown + "\n" + resultContent;
        }

        // Node embed backward compatibility
        const link = _.get(properties, "link");
        const linkDBId = _.toInteger(link);

        if (linkDBId) {
            const block = await this.getBlock(linkDBId as any);
            if (block) {
                const blockUUID = getUUIDFromBlock(block);
                if (blockUUID) {
                    resultContent = `{{embed ((${blockUUID}))}}` + "\n" + resultContent;
                }
            } else {
                const page = await this.getPage(linkDBId as EntityID);
                if (page) {
                    resultContent = `{{embed [[${page.uuid}]]}}` + "\n" + resultContent;
                }
            }
        }

        return resultContent;
    }

    /**
     * Protected methods that can be overridden in proxy class for caching.
     */
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        try {
            return await logseq.App.checkCurrentIsDbGraph() as boolean;
        } catch {
            return false;
        }
    }

    protected static async getPage(srcPage: PageIdentity | EntityID) {
        return await logseq.Editor.getPage(srcPage);
    }

    protected static async getBlock(srcBlock: string) {
        return await logseq.Editor.getBlock(srcBlock);
    }
}

/**
 * Proxy version that uses cached LogseqProxy methods.
 * Use this when working within the sync system where caching is beneficial.
 */
export class LogseqContentPreprocessorProxy extends LogseqContentPreprocessor {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        const { LogseqProxy } = await import("./LogseqProxy");
        return Boolean(await LogseqProxy.App.checkCurrentIsDbGraph());
    }

    protected static async getPage(srcPage: PageIdentity | EntityID) {
        const { LogseqProxy } = await import("./LogseqProxy");
        return await LogseqProxy.Editor.getPage(srcPage);
    }

    protected static async getBlock(srcBlock: string) {
        const { LogseqProxy } = await import("./LogseqProxy");
        return await LogseqProxy.Editor.getBlock(srcBlock);
    }

    static preprocess = pMemoize(
        async (content: string, format: "markdown" | "org" = "markdown"): Promise<PreprocessResult> => {
            // Call parent preprocess which will use our overridden methods (LogseqProxy)
            return await super.preprocess(content, format);
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});
}

if (typeof window !== 'undefined') {
    import("./WindowParentBridge").then(({ WindowParentBridge }) => {
        WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
            pMemoizeClear(LogseqContentPreprocessorProxy.preprocess);
        });
    });
}
