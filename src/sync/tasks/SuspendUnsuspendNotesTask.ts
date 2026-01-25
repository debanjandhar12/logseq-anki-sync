import { Note } from "../../anki-notes/Note";
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import * as AnkiConnect from "../../anki-connect/AnkiConnect";
import { ProgressNotification } from "../../ui";
import { SuspendUnsuspendPropertyParser } from "../parsers/SuspendUnsuspendPropertyParser";

export class SuspendUnsuspendNotesTask {
    async execute(
        notes: Note[],
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{ suspended: number, unsuspended: number }> {
        const cardsToSuspend: number[] = [];
        const cardsToUnsuspend: number[] = [];

        for (const note of notes) {
            try {
                const ankiId = note.getAnkiId();
                if (!ankiId || isNaN(ankiId)) continue;

                const shouldSuspend = await SuspendUnsuspendPropertyParser.parse(note);

                if (shouldSuspend === null) continue;

                const cardIds = this.getCardIdsForNote(ankiId, ankiNoteManager);
                
                if (shouldSuspend === true) {
                    cardsToSuspend.push(...cardIds);
                } else if (shouldSuspend === false) {
                    cardsToUnsuspend.push(...cardIds);
                }
            } catch (e) {
                console.error(`[SuspendUnsuspendNotesTask] Error processing note ${note.uuid}:`, e);
            }
        }

        // Batch execute suspend/unsuspend operations
        if (cardsToSuspend.length > 0) {
            console.log(`[SuspendUnsuspendNotesTask] Suspending ${cardsToSuspend.length} cards`);
            await AnkiConnect.suspend(cardsToSuspend);
        }

        if (cardsToUnsuspend.length > 0) {
            console.log(`[SuspendUnsuspendNotesTask] Unsuspending ${cardsToUnsuspend.length} cards`);
            await AnkiConnect.unsuspend(cardsToUnsuspend);
        }

        progressNotification.increment();

        return {
            suspended: cardsToSuspend.length,
            unsuspended: cardsToUnsuspend.length
        };
    }

    private getCardIdsForNote(ankiId: number, ankiNoteManager: LazyAnkiNoteManager): number[] {
        const noteInfo = ankiNoteManager.noteInfoMap.get(ankiId);
        if (!noteInfo || !noteInfo.cards) {
            return [];
        }
        return noteInfo.cards;
    }
}
