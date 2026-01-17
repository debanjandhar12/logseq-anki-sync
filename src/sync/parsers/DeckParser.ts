import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getLogseqBlockPropSafe } from "../../utils/utils";
import _ from "lodash";
import getNameFromPage from "../../logseq/getNameFromPage";
import { LOGSEQ_PAGE_REF_REGEXP } from "../../constants";

export class DeckParser {
    /**
     * Resolves the deck name for a note following the hierarchy:
     * 1. Block hierarchy (traverse up looking for deck property)
     * 2. Namespace hierarchy (traverse up looking for deck property)
     * 3. Current page name
     */
    static async parse(note: Note): Promise<string> {
        let deck = await this.findDeckInBlockHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck, note.page);

        deck = await this.findDeckInNamespaceHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck, note.page);

        const defaultDeck = await this.getDefaultDeck(note.page);
        return this.normalizeDeck(defaultDeck, note.page);
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
            console.error("[DeckParser] Error finding deck in block hierarchy:", e);
        }
        return null;
    }

    private static async findDeckInNamespaceHierarchy(note: Note): Promise<string | null> {
        try {
            const parents = await LogseqProxy.Editor.getParentNamespacePages(note.page);
            const hierarchy = [note.page, ...parents];
            for (const page of hierarchy) {
                const deck = getLogseqBlockPropSafe(page, "properties.deck");
                if (deck != null) return deck;
            }
        } catch (e) {
            console.error("[DeckParser] Error finding deck in namespace hierarchy:", e);
        }
        return null;
    }

    private static async getDefaultDeck(page: any): Promise<string> {
        return await LogseqProxy.Editor.getFullPageName(page);
    }

    private static async normalizeDeck(deck: any, page: any): Promise<string> {
        if (typeof deck !== "string") deck = deck[0];
        deck = deck.replace(LOGSEQ_PAGE_REF_REGEXP, "$1"); // Handle direct [[Page Name]] as deck value in db versions
        return deck.replaceAll("/", "::");  // convert to anki format and return
    }
}
