import _ from "lodash";
import {ANKI_CLOZE_REGEXP} from "../../constants";
import {createLogger, LoggerCategory} from "../../logger";
import * as AnkiConnect from "../AnkiConnect";
import {AnkiActionQueue} from "../internal/AnkiActionQueue";
import type {AddNotesResult, AnkiIdUuidPair, AnkiNoteFields, OperationFailure} from "../types";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

export class AddNoteOperation {
    private queue1: AnkiActionQueue = new AnkiActionQueue();
    private queue2: AnkiActionQueue = new AnkiActionQueue();
    private uuidTypeQueue1: string[] = [];
    private uuidTypeQueue2: string[] = [];

    addNote(deckName: string, modelName: string, fields: AnkiNoteFields, tags: string[]): void {
        // Queue 1: Create deck + add note with placeholder cloze
        this.queue1.push({
            action: "createDeck",
            params: {deck: deckName}
        });
        this.uuidTypeQueue1.push(fields["uuid-type"]);

        const cloze_id = _.get(ANKI_CLOZE_REGEXP.exec(fields["Text"]), 2) || 1;
        this.queue1.push({
            action: "addNote",
            params: {
                note: {
                    modelName: modelName,
                    deckName: deckName,
                    fields: {
                        ...fields,
                        Text: `{{c${cloze_id}:: placeholder}}`
                    },
                    tags: tags,
                    options: {allowDuplicate: true}
                }
            }
        });
        this.uuidTypeQueue1.push(fields["uuid-type"]);

        // Queue 2: Update note with actual content
        this.queue2.push({
            action: "updateNoteFields",
            params: {
                note: {
                    deckName: deckName,
                    modelName: modelName,
                    fields: fields
                }
            }
        });
        this.uuidTypeQueue2.push(fields["uuid-type"]);
    }

    async execute(): Promise<AddNotesResult> {
        logger.info("Executing add notes operation", this.queue1, this.queue2);

        // Execute queue 1: Create notes with dummy content (required to do this due to anki bug where note creation fails otherwise)
        const result1 = await this.queue1.execute();
        const failedNotes: OperationFailure[] = [];

        for (let i = 0; i < result1.length; i++) {
            if (result1[i]?.error) {
                const error = result1[i].error;
                failedNotes.push({
                    identifier: this.uuidTypeQueue1[i],
                    error: typeof error === "string" ? new Error(error) : error
                });
            }
        }

        // Get ankiId of newly added notes
        const getAnkiIdActionsQueue: any[] = [];
        for (const uuidType of this.uuidTypeQueue2) {
            getAnkiIdActionsQueue.push({
                action: "findNotes",
                params: {query: `uuid-type:${uuidType}`}
            });
        }

        const ankiIdActionsQueueRes = await AnkiConnect.invoke("multi", {
            actions: getAnkiIdActionsQueue
        });

        const ankiId: number[] = [];
        const successfulNotes: AnkiIdUuidPair[] = [];
        for (let i = 0; i < ankiIdActionsQueueRes.length; i++) {
            if (ankiIdActionsQueueRes[i] == null) ankiIdActionsQueueRes[i] = [];
            ankiId[i] = ankiIdActionsQueueRes[i][0];
            if (ankiId[i] != null) {
                successfulNotes.push({
                    "uuid-type": this.uuidTypeQueue2[i],
                    ankiId: ankiIdActionsQueueRes[i][0]
                });
            }
        }

        // Update note fields with ankiId
        const queue2Actions = this.queue2.getActions();
        for (let i = 0; i < queue2Actions.length; i++) {
            if (ankiId[i] != null) {
                queue2Actions[i].params.note.id = ankiId[i];
            }
        }

        // Execute queue 2: Update with actual content
        const result2 = await this.queue2.execute();
        for (let i = 0; i < result2.length; i++) {
            if (result2[i]?.error) {
                const error = result2[i].error;
                failedNotes.push({
                    identifier: this.uuidTypeQueue2[i],
                    error: typeof error === "string" ? new Error(error) : error
                });
            }
        }

        // Clear queues
        this.queue1.clear();
        this.queue2.clear();
        this.uuidTypeQueue1 = [];
        this.uuidTypeQueue2 = [];

        logger.info("Add notes operation completed", {successfulNotes, failedNotes});
        return {
            successfulNotes,
            failedNotes
        };
    }
}
