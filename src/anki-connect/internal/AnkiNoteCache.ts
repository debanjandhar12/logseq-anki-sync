import {createLogger, LoggerCategory} from "../../logger";
import * as AnkiConnect from "../AnkiConnect";
import type {AnkiNoteInfo} from "../types";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

export class AnkiNoteCache {
    private noteInfoMap: Map<number, AnkiNoteInfo> = new Map();
    private mediaInfo: Set<string> = new Set();

    async buildNoteInfoMap(modelName: string): Promise<void> {
        const noteIds = await AnkiConnect.query(`"note:${modelName}"`);
        const notes = await AnkiConnect.invoke("notesInfo", {notes: noteIds});

        // Build reverse lookup: card ID → deck name
        const cardIds = notes.map((note: any) => note.cards[0]).filter(Boolean);
        const decks = await AnkiConnect.invoke("getDecks", {cards: cardIds});
        const cardToDeck = new Map<string, string>();
        for (const [deckName, cards] of Object.entries(decks)) {
            for (const cardId of cards as any[]) {
                cardToDeck.set(cardId.toString(), deckName);
            }
        }

        // Add deck info based on first card to note object
        for (const note of notes) {
            const firstCardId = note.cards[0];
            const deck = firstCardId ? cardToDeck.get(firstCardId.toString()) || "" : "";
            this.noteInfoMap.set(note.noteId, {...note, deck});
        }

        logger.debug("noteInfoMap built", this.noteInfoMap);
    }

    async buildMediaInfo(): Promise<void> {
        const mediaFileNames = await AnkiConnect.invoke("getMediaFilesNames", {});
        this.mediaInfo = new Set(mediaFileNames);

        logger.debug("mediaInfo built", this.mediaInfo);
    }

    getNoteInfo(ankiId: number): AnkiNoteInfo | undefined {
        return this.noteInfoMap.get(ankiId);
    }

    hasMedia(filename: string): boolean {
        return this.mediaInfo.has(filename);
    }

    get noteInfoMapRaw(): Map<number, AnkiNoteInfo> {
        return this.noteInfoMap;
    }
}
