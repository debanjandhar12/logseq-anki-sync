import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getLogseqBlockPropSafe, splitNamespace } from "../../utils/utils";
import _ from "lodash";

export class DeckParser {
    /**
     * Resolves the deck name for a note following the hierarchy:
     * 1. Block hierarchy (traverse up looking for deck property)
     * 2. Namespace hierarchy (traverse up looking for deck property)
     * 3. Namespace as deck (if useNamespaceAsDefaultDeck is true)
     * 4. Default deck from settings
     */
    static async parse(note: Note): Promise<string> {
        const useNamespaceAsDefault = await this.resolveUseNamespaceFlag(note);
        
        let deck = await this.findDeckInBlockHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck);

        deck = await this.findDeckInNamespaceHierarchy(note);
        if (deck !== null) return this.normalizeDeck(deck);

        if (useNamespaceAsDefault) {
            deck = this.extractNamespaceDeck(note);
            if (deck) return this.normalizeDeck(deck);
        }

        return this.normalizeDeck(this.getDefaultDeck());
    }

    private static async resolveUseNamespaceFlag(note: Note): Promise<boolean> {
        try {
            let parentNamespaceID: number = note.page.id;
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                if (!parentNamespacePage) break;

                const propValue = getLogseqBlockPropSafe(
                    parentNamespacePage,
                    "properties.use-namespace-as-default-deck"
                );
                if ([true, "true"].includes(propValue)) return true;
                if ([false, "false"].includes(propValue)) return false;

                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error("[DeckParser] Error resolving useNamespaceFlag:", e);
        }

        const { useNamespaceAsDefaultDeck } = LogseqProxy.Settings.getPluginSettings();
        return useNamespaceAsDefaultDeck;
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
            let parentNamespaceID: number = note.page.id;
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                if (!parentNamespacePage) break;
                const deck = getLogseqBlockPropSafe(parentNamespacePage, "properties.deck");
                if (deck != null) return deck;
                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error("[DeckParser] Error finding deck in namespace hierarchy:", e);
        }
        return null;
    }

    private static extractNamespaceDeck(note: Note): string {
        const pageName = _.get(note, "page.originalName", "") || 
                        _.get(note, "page.properties.title", "");
        const namespaceSegments = splitNamespace(pageName);
        return namespaceSegments.slice(0, -1).join("/");
    }

    private static getDefaultDeck(): string {
        const { defaultDeck } = LogseqProxy.Settings.getPluginSettings();
        return defaultDeck || "Default";
    }

    private static normalizeDeck(deck: any): string {
        if (typeof deck !== "string") deck = deck[0];
        return splitNamespace(deck).join("::");
    }
}
