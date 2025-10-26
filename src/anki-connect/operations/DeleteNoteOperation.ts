import { AnkiActionQueue } from "../internal/AnkiActionQueue";
import { DeleteNotesResult, AnkiOperationError } from "../types";
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

        const results: AnkiOperationError[] = [];
        for (let i = 0; i < result.length; i++) {
            if (result[i] == null) result[i] = {};
            _.extend(result[i], {
                ankiId: this.ankiIdQueue[i],
            });
            results.push(result[i]);
        }

        this.queue.clear();
        this.ankiIdQueue = [];

        return { results };
    }
}
