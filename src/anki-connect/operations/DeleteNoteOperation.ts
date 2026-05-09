import {createLogger, LoggerCategory} from "../../logger";
import {AnkiActionQueue} from "../internal/AnkiActionQueue";
import type {DeleteNotesResult, OperationFailure} from "../types";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

export class DeleteNoteOperation {
    private queue: AnkiActionQueue = new AnkiActionQueue();
    private ankiIdQueue: number[] = [];

    deleteNote(ankiId: number): void {
        this.queue.push({
            action: "deleteNotes",
            params: {notes: [ankiId]}
        });
        this.ankiIdQueue.push(ankiId);
    }

    async execute(): Promise<DeleteNotesResult> {
        logger.info("Executing delete notes operation", this.queue);

        const result = await this.queue.execute();

        const successfulNotes: number[] = [];
        const failedNotes: OperationFailure[] = [];
        for (let i = 0; i < result.length; i++) {
            const ankiId = this.ankiIdQueue[i];
            if (result[i]?.error) {
                const error = result[i].error;
                failedNotes.push({
                    identifier: ankiId.toString(),
                    error: typeof error === "string" ? new Error(error) : error
                });
            } else {
                successfulNotes.push(ankiId);
            }
        }

        this.queue.clear();
        this.ankiIdQueue = [];

        logger.info("Delete notes operation completed", {successfulNotes, failedNotes});
        return {successfulNotes, failedNotes};
    }
}
