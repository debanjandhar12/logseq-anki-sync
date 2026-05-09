import * as AnkiConnect from "../../anki-connect/AnkiConnect";
import {AnkiNoteCache} from "../../anki-connect/internal/AnkiNoteCache";
import type {LazyAnkiNoteManager} from "../../anki-connect/LazyAnkiNoteManager";
import type {Note} from "../../anki-notes/Note";
import {createLogger, LoggerCategory} from "../../logger";
import type {ProgressNotification} from "../../ui";
import {SuspendUnsuspendPropertyParser} from "../parsers/SuspendUnsuspendPropertyParser";

const logger = createLogger(LoggerCategory.SyncInternal);

export class SuspendUnsuspendNotesTask {
    async execute(
        notes: Note[],
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{suspended: number; unsuspended: number}> {
        const freshCache = new AnkiNoteCache();
        await freshCache.buildNoteInfoMap(ankiNoteManager.modelName); // Build fresh cache to include newly created notes

        const cardsToSuspend: number[] = [];
        const cardsToUnsuspend: number[] = [];

        for (const note of notes) {
            try {
                const ankiId = note.getAnkiId();
                if (!ankiId || Number.isNaN(ankiId)) continue;

                const shouldSuspend = await SuspendUnsuspendPropertyParser.parse(note);

                if (shouldSuspend === null) continue;

                const cardIds = this.getCardIdsForNote(ankiId, freshCache);

                if (shouldSuspend === true) {
                    cardsToSuspend.push(...cardIds);
                } else if (shouldSuspend === false) {
                    cardsToUnsuspend.push(...cardIds);
                }
            } catch (e) {
                logger.error(`Error processing note ${note.uuid}`, e);
            }
        }

        // Batch execute suspend/unsuspend operations
        if (cardsToSuspend.length > 0) {
            logger.info(`Suspending ${cardsToSuspend.length} cards`);
            await AnkiConnect.suspend(cardsToSuspend);
        }

        if (cardsToUnsuspend.length > 0) {
            logger.info(`Unsuspending ${cardsToUnsuspend.length} cards`);
            await AnkiConnect.unsuspend(cardsToUnsuspend);
        }

        progressNotification.increment();

        return {
            suspended: cardsToSuspend.length,
            unsuspended: cardsToUnsuspend.length
        };
    }

    private getCardIdsForNote(ankiId: number, cache: AnkiNoteCache): number[] {
        const noteInfo = cache.getNoteInfo(ankiId);
        if (!noteInfo?.cards) {
            return [];
        }
        return noteInfo.cards;
    }
}
