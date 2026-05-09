import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import type {Note} from "../../anki-notes/Note";
import {ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP} from "../../constants";
import {createLogger, LoggerCategory} from "../../logger";
import getNameFromPage from "../../logseq/getNameFromPage";
import {LogseqProxy} from "../../logseq/LogseqProxy";

const logger = createLogger(LoggerCategory.SyncInternal);

export class BreadcrumbAndParentBlockParser {
    static async parse(note: Note, graphName: string, tags: Set<string>): Promise<string> {
        const {breadcrumbDisplayOptions} = LogseqProxy.Settings.getPluginSettings();
        const options = breadcrumbDisplayOptions || [];

        // If no breadcrumb options selected, return hidden breadcrumb
        if (options.length === 0 || !options.includes("Page name")) {
            return await BreadcrumbAndParentBlockParser.buildHiddenBreadcrumb(note, graphName);
        }

        // Build breadcrumb based on selected options
        return await BreadcrumbAndParentBlockParser.buildBreadcrumb(note, graphName, options, tags);
    }

    private static async buildHiddenBreadcrumb(note: Note, graphName: string): Promise<string> {
        const page = await LogseqProxy.Editor.getPage(note.pageId);
        const pageName = getNameFromPage(page);
        return `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            pageName
        )}" class="hidden">${pageName}</a>`;
    }

    private static async buildBreadcrumb(
        note: Note,
        graphName: string,
        options: string[],
        tags: Set<string>
    ): Promise<string> {
        const page = await LogseqProxy.Editor.getPage(note.pageId);

        // Get the display name for the page link
        let displayName: string;
        let fullPageName: string;

        if (options.includes("Page namespace")) {
            // Get full page name with namespace (handles both DB and File versions)
            fullPageName = await BreadcrumbAndParentBlockParser.getFullPageNameWithNamespace(page);
            displayName = fullPageName;
        } else {
            // For file version of logseq, we need to extract just the page name without namespace
            const rawName = getNameFromPage(page);
            if (rawName?.includes("/")) {
                // In file version, page name contains namespace (e.g., "Parent/Child")
                // Extract just the last segment
                displayName = rawName.split("/").pop() || rawName;
            } else {
                displayName = rawName;
            }
            fullPageName = displayName;
        }

        let breadcrumb = `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            fullPageName
        )}" title="${displayName}">📄${displayName}</a>`;

        // Add parent blocks if enabled
        if (options.includes("Parent blocks")) {
            try {
                const parentBlocks = await BreadcrumbAndParentBlockParser.collectParentBlocks(
                    note,
                    tags
                );
                for (const parentBlock of parentBlocks) {
                    const firstLine = parentBlock.content.split("\n")[0];
                    breadcrumb += ` > <a href="logseq://graph/${encodeURIComponent(
                        graphName
                    )}?block-id=${encodeURIComponent(parentBlock.uuid)}" title="${
                        parentBlock.content
                    }">⚪${firstLine}</a>`;
                }
            } catch (e) {
                logger.error(
                    "[BreadcrumbAndParentBlockParser] Error adding parent blocks to breadcrumb:",
                    e
                );
            }
        }

        return breadcrumb;
    }

    /**
     * Gets the full page name including namespace for DB version.
     * For file version, the page name already contains namespace.
     */
    private static async getFullPageNameWithNamespace(page: any): Promise<string> {
        const baseName = getNameFromPage(page) || "";

        // In file version, page.name already contains namespace (e.g., "Parent/Child")
        // In DB version, we need to build the namespace from parent pages
        const isFileVersion = baseName?.includes("/");

        if (isFileVersion) {
            return baseName;
        }

        // DB version: build namespace from parent pages
        const parents = await LogseqProxy.Editor.getParentNamespacePages(page);
        if (parents.length === 0) {
            return baseName;
        }

        const segments = [...parents.reverse().map((p) => getNameFromPage(p)), baseName];
        return segments.filter((s) => !!s).join("/");
    }

    private static async collectParentBlocks(
        note: Note,
        tags: Set<string>
    ): Promise<Array<{content: string; uuid: string}>> {
        const parentBlocks = [];
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parentBlock: BlockEntity;

        while ((parentBlock = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            const parentTags = _.get(parentBlock, "properties.tags", []) as string[];
            const hiddenParent =
                parentTags.includes("hide-when-card-parent") ||
                Array.from(tags).includes("hide-all-card-parent");

            parentBlocks.push({
                content: !hiddenParent
                    ? parentBlock.content
                          .replaceAll(MD_PROPERTIES_REGEXP, "")
                          .replaceAll(ANKI_CLOZE_REGEXP, "$3")
                    : "Hidden Parent Block",
                uuid: parentBlock.uuid
            });
            parentID = parentBlock.parent.id;
        }

        return parentBlocks.reverse();
    }
}
