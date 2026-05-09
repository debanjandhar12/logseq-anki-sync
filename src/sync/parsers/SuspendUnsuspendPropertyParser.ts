import _ from "lodash";
import type {Note} from "../../anki-notes/Note";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {getLogseqBlockPropSafe} from "../../utils/utils";

const logger = createLogger(LoggerCategory.SyncInternal);

export class SuspendUnsuspendPropertyParser {
    /**
     * Resolves the suspend-anki-card property for a note following the hierarchy:
     * 1. Block hierarchy (traverse up looking for suspend-anki-card property)
     * 2. Namespace hierarchy (traverse up looking for suspend-anki-card property)
     * 3. Return null (do nothing)
     *
     * @param note The note to check
     * @returns true to suspend, false to unsuspend, null to do nothing
     */
    static async parse(note: Note): Promise<boolean | null> {
        let suspendValue = await SuspendUnsuspendPropertyParser.findSuspendInBlockHierarchy(note);
        if (suspendValue !== null) {
            return suspendValue;
        }

        suspendValue = await SuspendUnsuspendPropertyParser.findSuspendInNamespaceHierarchy(note);
        if (suspendValue !== null) {
            return suspendValue;
        }

        return null;
    }

    private static async findSuspendInBlockHierarchy(note: Note): Promise<boolean | null> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                const suspendValue = getLogseqBlockPropSafe(
                    parentBlock,
                    "properties.suspend-anki-card"
                );
                if (suspendValue != null)
                    return SuspendUnsuspendPropertyParser.normalizeValue(suspendValue);
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            logger.error(
                "[SuspendUnsuspendPropertyParser] Error finding suspend-anki-card in block hierarchy:",
                e
            );
        }
        return null;
    }

    private static async findSuspendInNamespaceHierarchy(note: Note): Promise<boolean | null> {
        try {
            const page = await LogseqProxy.Editor.getPage(note.pageId);
            const parents = await LogseqProxy.Editor.getParentNamespacePages(page);
            const hierarchy = [page, ...parents];
            for (const currentPage of hierarchy) {
                const suspendValue = getLogseqBlockPropSafe(
                    currentPage,
                    "properties.suspend-anki-card"
                );
                if (suspendValue != null)
                    return SuspendUnsuspendPropertyParser.normalizeValue(suspendValue);
            }
        } catch (e) {
            logger.error(
                "[SuspendUnsuspendPropertyParser] Error finding suspend-anki-card in namespace hierarchy:",
                e
            );
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
