import { AnkiActionQueue } from "../internal/AnkiActionQueue";
import { AnkiNoteCache } from "../internal/AnkiNoteCache";
import { AnkiNoteFields, UpdateNotesResult, OperationFailure } from "../types";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import _ from "lodash";

export class UpdateNoteOperation {
    private queue: AnkiActionQueue = new AnkiActionQueue();
    private uuidTypeQueue: string[] = [];

    constructor(private cache: AnkiNoteCache) {}

    updateNote(
        ankiId: number,
        deckName: string,
        modelName: string,
        fields: AnkiNoteFields,
        tags: string[]
    ): void {
        const noteinfo = this.cache.getNoteInfo(ankiId);
        if (!noteinfo) {
            console.error(`[UpdateNoteOperation] Note ${ankiId} not found in cache`);
            return;
        }

        const cards = noteinfo.cards;

        // Change deck if needed
        if (deckName !== noteinfo.deck) {
            this.queue.push({
                action: "changeDeck",
                params: { cards: cards, deck: deckName },
            });
            this.uuidTypeQueue.push(fields["uuid-type"]);
        }

        // Handle tag changes
        let to_remove_tags = _.difference(noteinfo.tags, tags);
        to_remove_tags = to_remove_tags.filter(
            (tag) => tag.toLowerCase() !== "leech"
        );
        to_remove_tags = to_remove_tags.filter(
            (tag) => tag.toLowerCase() !== "marked"
        );
        const to_add_tags = _.difference(tags, noteinfo.tags);

        for (const tag of to_remove_tags) {
            this.queue.push({
                action: "removeTags",
                params: { notes: [ankiId], tags: tag },
            });
            this.uuidTypeQueue.push(fields["uuid-type"]);
        }

        for (const tag of to_add_tags) {
            this.queue.push({
                action: "addTags",
                params: { notes: [ankiId], tags: tag },
            });
            this.uuidTypeQueue.push(fields["uuid-type"]);
        }

        // Check if fields need update
        let needsFieldUpdate = false;
        for (const key in fields) {
            if (noteinfo.fields[key as keyof typeof fields]?.value !== fields[key as keyof typeof fields]) {
                const { debug } = LogseqProxy.Settings.getPluginSettings();
                if (debug.includes("LazyAnkiNoteManager.ts")) {
                    console.log(
                        "[UpdateNoteOperation] Difference found:",
                        key,
                        noteinfo.fields[key as keyof typeof fields]?.value,
                        fields[key as keyof typeof fields]
                    );
                }
                needsFieldUpdate = true;
                break;
            }
        }

        if (needsFieldUpdate) {
            this.queue.push({
                action: "updateNoteFields",
                params: {
                    note: {
                        id: ankiId,
                        deckName: deckName,
                        modelName: modelName,
                        fields: fields,
                    },
                },
            });
            this.uuidTypeQueue.push(fields["uuid-type"]);
        }
    }

    async execute(): Promise<UpdateNotesResult> {
        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug.includes("LazyAnkiNoteManager.ts")) {
            console.log("[UpdateNoteOperation] queue:", this.queue);
        }

        const result = await this.queue.execute();

        if (debug.includes("LazyAnkiNoteManager.ts")) {
            console.log("[UpdateNoteOperation] result:", result);
        }

        const successfulNotes: string[] = [];
        const failedNotes: OperationFailure[] = [];
        for (let i = 0; i < result.length; i++) {
            const uuidType = this.uuidTypeQueue[i];
            if (result[i]?.error) {
                const error = result[i].error;
                failedNotes.push({
                    identifier: uuidType,
                    error: typeof error === 'string' ? new Error(error) : error,
                });
            } else {
                successfulNotes.push(uuidType);
            }
        }

        this.queue.clear();
        this.uuidTypeQueue = [];

        return { successfulNotes, failedNotes };
    }
}
