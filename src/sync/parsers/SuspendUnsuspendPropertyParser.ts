import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getCaseInsensitive } from "../../utils/utils";
import _ from "lodash";

export class SuspendUnsuspendPropertyParser {
    /**
     * Resolves the suspend-anki-card property for a note.
     * Resolution order:
     * 1. Current block properties
     * 2. Parent block properties (traversing up)
     * 3. Page properties
     * 4. Namespace parent pages (traversing up)
     * 
     * @param note The note to check
     * @returns true to suspend, false to unsuspend, null to do nothing
     */
    static async parse(note: Note): Promise<boolean | null> {
        // Check current block property
        const blockProperty = getCaseInsensitive(note.properties, "suspend-anki-card", undefined);
        if (blockProperty !== undefined) {
            return this.normalizeValue(blockProperty);
        }

        // Traverse parent blocks
        const parentBlockValue = await this.checkParentBlocks(note);
        if (parentBlockValue !== null) {
            return parentBlockValue;
        }

        // Check page and namespace hierarchy
        const pageValue = await this.checkPageHierarchy(note);
        if (pageValue !== null) {
            return pageValue;
        }

        return null;
    }

    private static async checkParentBlocks(note: Note): Promise<boolean | null> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            const visited = new Set<string | number>();

            while (parentBlockUUID != null) {
                if (visited.has(parentBlockUUID)) break;
                visited.add(parentBlockUUID);

                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                if (!parentBlock) break;

                const property = getCaseInsensitive(parentBlock, "properties.suspend-anki-card", undefined);
                if (property !== undefined) {
                    return this.normalizeValue(property);
                }

                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            console.error("[SuspendUnsuspendPropertyParser] Error checking parent blocks:", e);
        }
        return null;
    }

    private static async checkPageHierarchy(note: Note): Promise<boolean | null> {
        try {
            const page = await LogseqProxy.Editor.getPage(note.pageId);
            if (!page) return null;

            const parents = await LogseqProxy.Editor.getParentNamespacePages(page);
            const hierarchy = [page, ...parents];

            for (const currentPage of hierarchy) {
                const property = getCaseInsensitive(currentPage, "properties.suspend-anki-card", undefined);
                if (property !== undefined) {
                    return this.normalizeValue(property);
                }
            }
        } catch (e) {
            console.error("[SuspendUnsuspendPropertyParser] Error checking page hierarchy:", e);
        }
        return null;
    }

    private static normalizeValue(value: any): boolean | null {
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            const lower = value.toLowerCase().trim();
            if (lower === "true" || lower === "yes" || lower === "1") return true;
            if (lower === "false" || lower === "no" || lower === "0") return false;
        }
        return null;
    }
}
