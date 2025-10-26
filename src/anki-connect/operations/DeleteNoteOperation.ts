import { AnkiActionQueue } from "../internal/AnkiActionQueue";
import { DeleteNotesResult, OperationFailure } from "../types";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import _ from "lodash";

export class DeleteNoteOperation {
    private queue: AnkiActionQueue = new AnkiActionQueue();
    private ankiIdQueue: number[] = [];

    deleteNote(ankiId: number): void {
        this.queue.push({
            action: "deleteNotes",
            params: { notes: [ankiId] },
        });
        this.ankiIdQueue.push(ankiId);
    }

    async execute(): Promise<DeleteNotesResult> {
        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug.includes("LazyAnkiNoteManager.ts")) {
            console.log("[DeleteNoteOperation] ankiIdQueue:", this.ankiIdQueue);
        }

        const result = await this.queue.execute();

        const successfulNotes: number[] = [];
        const failedNotes: OperationFailure[] = [];
        for (let i = 0; i < result.length; i++) {
            const ankiId = this.ankiIdQueue[i];
            if (result[i]?.error) {
                const error = result[i].error;
                failedNotes.push({
                    identifier: ankiId.toString(),
                    error: typeof error === 'string' ? new Error(error) : error,
                });
            } else {
                successfulNotes.push(ankiId);
            }
        }

        this.queue.clear();
        this.ankiIdQueue = [];

        return { successfulNotes, failedNotes };
    }
}
