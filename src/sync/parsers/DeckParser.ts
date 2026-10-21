import _ from "lodash";
import type {Note} from "../../anki-notes/Note";
import {LOGSEQ_PAGE_REF_REGEXP} from "../../constants";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {getLogseqBlockPropSafe} from "../../utils/utils";

const logger = createLogger(LoggerCategory.SyncInternal);

export class DeckParser {
    /**
     * Resolves the deck name for a note following the hierarchy:
     * 1. Block hierarchy (traverse up looking for deck property)
     * 2. Namespace hierarchy (traverse up looking for deck property)
     * 3. Configured fallback for standalone pages, otherwise current page name
     */
    static async parse(note: Note): Promise<string> {
        let deck = await DeckParser.findDeckInBlockHierarchy(note);
        if (deck !== null) {
            return DeckParser.normalizeDeck(deck);
        }

        deck = await DeckParser.findDeckInNamespaceHierarchy(note);
        if (deck !== null) {
            return DeckParser.normalizeDeck(deck);
        }

        const defaultDeck = await DeckParser.getDefaultDeck(note.pageId);
        return DeckParser.normalizeDeck(defaultDeck);
    }

    private static async findDeckInBlockHierarchy(note: Note): Promise<string | null> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                const deck = getLogseqBlockPropSafe(parentBlock, "properties.deck");
                if (deck != null) return deck;
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            logger.error("[DeckParser] Error finding deck in block hierarchy:", e);
        }
        return null;
    }

    private static async findDeckInNamespaceHierarchy(note: Note): Promise<string | null> {
        try {
            const page = await LogseqProxy.Editor.getPage(note.pageId);
            const parents = await LogseqProxy.Editor.getParentNamespacePages(page);
            const hierarchy = [page, ...parents];
            for (const page of hierarchy) {
                const deck = getLogseqBlockPropSafe(page, "properties.deck");
                if (deck != null) return deck;
            }
        } catch (e) {
            logger.error("[DeckParser] Error finding deck in namespace hierarchy:", e);
        }
        return null;
    }

    private static async getDefaultDeck(pageId: number): Promise<string> {
        const page = await LogseqProxy.Editor.getPage(pageId);
        const settings = LogseqProxy.Settings.getPluginSettings();
        if (page && settings.standalonePageDeckBehavior !== "Derive from page name") {
            const parents = await LogseqProxy.Editor.getParentNamespacePages(page, {
                includeLibrary: false,
                suppressErrors: false
            });
            if (parents.length === 0) {
                const descendants = await LogseqProxy.Editor.getNamespaceDescendants(page, {
                    suppressErrors: false
                });
                if (descendants.length === 0) {
                    // Set from setting for standalone pages (no namespace ancestors nor child pages)
                    return settings.standalonePageDeckName?.trim() || "Default";
                }
            }
        }
        // Use page name for non-standalone pages or when Derive from page name is set
        return await LogseqProxy.Editor.getFullPageName(page, {includeLibrary: false});
    }

    private static async normalizeDeck(deck: any): Promise<string> {
        if (typeof deck !== "string") deck = deck[0];
        deck = deck.replace(LOGSEQ_PAGE_REF_REGEXP, "$1"); // Handle direct [[Page Name]] as deck value in db versions
        return deck.replaceAll("/", "::"); // convert to anki format and return
    }
}
