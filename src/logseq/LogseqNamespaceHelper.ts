import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import getNameFromPage from "./getNameFromPage";
import {LogseqAppInfoFetcher} from "./LogseqAppInfoFetcher";
import {LogseqPropertiesHelper} from "./LogseqPropertiesHelper";
import {LogseqProxy} from "./LogseqProxy";

export class LogseqNamespaceHelper {
    protected static async getPage(pageId: number): Promise<PageEntity | null> {
        return await LogseqPropertiesHelper.getPage(pageId);
    }

    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return await LogseqAppInfoFetcher.checkCurrentIsDbGraph();
    }

    /**
     * Gets the parent page of a given page.
     * Handles both DB version (page.parent) and File version (page.namespace.id).
     */
    static async getParentPage(page: PageEntity): Promise<PageEntity | null> {
        let parentId = _.get(page, "parent.id") || _.get(page, "parent");
        if (parentId == null) {
            parentId = _.get(page, "namespace.id");
        }

        if (parentId != null && parentId !== page.id) {
            return await LogseqNamespaceHelper.getPage(parentId as number);
        }
        return null;
    }

    /**
     * Gets the full chain of ancestor pages (parent, grandparent, etc.).
     * Works with both logseq db version and File version.
     * Ordered from immediate parent to root.
     * @param page The page to get ancestors for
     * @param opts Options for the query
     * @param opts.includeLibrary Whether to include Library pages in the hierarchy (default: true)
     */
    static async getParentNamespacePages(
        page: PageEntity,
        opts: Partial<{includeLibrary: boolean}> = {includeLibrary: true}
    ): Promise<PageEntity[]> {
        const {includeLibrary = true} = opts;
        const parents: PageEntity[] = [];
        const visited = new Set<number>();
        if (page.id) visited.add(page.id);

        let current = page;
        while (true) {
            const parent = await LogseqNamespaceHelper.getParentPage(current);
            if (!parent) break;
            if (!includeLibrary && getNameFromPage(parent)?.toLowerCase() === "library") break;

            // Cycle detection and self-check
            if (parent.id && visited.has(parent.id)) break;
            if (parent.id) visited.add(parent.id);

            parents.push(parent);
            current = parent;
        }
        return parents;
    }

    /**
     * Gets all descendant pages recursively.
     */
    static async getNamespaceDescendants(page: PageEntity): Promise<PageEntity[]> {
        if (await LogseqNamespaceHelper.checkCurrentIsDbGraph()) {
            // logseq.Editor.getPagesFromNamespace does not work for db ver
            // Hence, we use query to fetch namespace decendants
            const query = `[:find ?child
                :where
                [?parent-page :block/name "${page.name.toLowerCase()}"]
                (or [?parent :block/name "${page.name.toLowerCase()}"]
                    [?parent :block/parent ?parent-page])
                [?child :block/parent ?parent]
                [?child :block/tags :logseq.class/Page]]`;

            const recursive_hierarchy = await logseq.DB.datascriptQuery(query);
            const result: PageEntity[] = [];
            for (const [page_id] of recursive_hierarchy) {
                const block = await LogseqNamespaceHelper.getPage(page_id);
                if (!block) break;
                result.push(block);
            }
            return result;
        }
        return await logseq.Editor.getPagesFromNamespace(getNameFromPage(page)); // Must pass name - page id throws error
    }
}

export class LogseqNamespaceHelperProxy extends LogseqNamespaceHelper {
    protected static async checkCurrentIsDbGraph(): Promise<boolean> {
        return Boolean(await LogseqProxy.App.checkCurrentIsDbGraph());
    }

    protected static async getPage(pageId: number): Promise<PageEntity | null> {
        return await LogseqProxy.Editor.getPage(pageId);
    }
}
