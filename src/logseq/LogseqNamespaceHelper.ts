import { PageEntity } from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import getNameFromPage from "./getNameFromPage";
import { LogseqPropertiesHelper } from "./LogseqPropertiesHelper";
import { LogseqProxy } from "./LogseqProxy";

export class LogseqNamespaceHelper {
    protected static async getPage(pageId: number): Promise<PageEntity | null> {
        return await LogseqPropertiesHelper.getPage(pageId);
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
            return await this.getPage(parentId as number);
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
        opts: Partial<{ includeLibrary: boolean }> = { includeLibrary: true }
    ): Promise<PageEntity[]> {
        const { includeLibrary = true } = opts;
        const parents: PageEntity[] = [];
        const visited = new Set<number>();
        if (page.id) visited.add(page.id);

        let current = page;
        while (true) {
            const parent = await this.getParentPage(current);
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
        // TBU: Implement this for preview anki addon.. does not work currently
        return await logseq.Editor.getPagesFromNamespace(getNameFromPage(page));
    }
}

export class LogseqNamespaceHelperProxy extends LogseqNamespaceHelper {
    protected static async getPage(pageId: number): Promise<PageEntity | null> {
        return await LogseqProxy.Editor.getPage(pageId);
    }
}