/**
 * This file is extremely messy - written in less than an hour, never cleaned.
 * I will clean it up as soon as possible. Promise :')
 */
import * as AnkiConnect from "./AnkiConnect";
import _ from "lodash";
import "@logseq/libs";
import {ANKI_CLOZE_REGEXP} from "../constants";

export class LazyAnkiNoteManager {
    public modelName: string;
    public noteInfoMap: Map<any, any> = new Map();
    public mediaInfo: Set<string> = new Set();
    private addNoteActionsQueue1: Array<any> = [];
    private addNoteActionsQueue2: Array<any> = [];
    private addNoteUuidTypeQueue1: Array<any> = [];
    private addNoteUuidTypeQueue2: Array<any> = [];
    private updateNoteActionsQueue: Array<any> = [];
    private updateNoteUuidTypeQueue: Array<any> = [];
    private deleteNoteActionsQueue: Array<any> = [];
    private deleteNoteAnkiIdQueue: Array<any> = [];
    private storeAssetActionsQueue: Array<any> = [];

    constructor(modelName: string) {
        this.modelName = modelName;
    }

    async init() {
        await this.buildNoteInfoMap(this.modelName);
        await this.buildMediaInfo();
    }

    async buildNoteInfoMap(modelName: string): Promise<any> {
        const result = await AnkiConnect.query(`"note:${modelName}"`);
        const notes = await AnkiConnect.invoke("notesInfo", {notes: result});
        const cards = [];
        for (const note of notes) {
            if (note.cards[0]) cards.push(note.cards[0]);
        }
        const decks = await AnkiConnect.invoke("getDecks", {cards: cards});
        for (const note of notes) {
            // can be reduced to n log n
            let deck = "";
            for (const prop in decks) {
                if (decks[prop].includes(note.cards[0])) {
                    deck = prop;
                    break;
                }
            }
            this.noteInfoMap.set(note.noteId, {...note, deck});
        }
        if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
            console.debug(this.noteInfoMap);
    }

    async buildMediaInfo(): Promise<void> {
        const mediaFileNames = await AnkiConnect.invoke("getMediaFilesNames", {});
        this.mediaInfo = new Set(mediaFileNames);
        if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
            console.debug(this.mediaInfo);
    }

    addNote(deckName: string, modelName: string, fields, tags: string[]): void {
        this.addNoteActionsQueue1.push({
            action: "createDeck",
            params: {deck: deckName},
        });
        this.addNoteUuidTypeQueue1.push(fields["uuid-type"]);
        const cloze_id = _.get(ANKI_CLOZE_REGEXP.exec(fields["Text"]), 2) || 1;
        this.addNoteActionsQueue1.push({
            action: "addNote",
            params: {
                note: {
                    modelName: modelName,
                    deckName: deckName,
                    fields: {
                        ...fields,
                        Text: `{{c${cloze_id}:: placeholder}}`,
                    },
                    tags: tags,
                    options: {allowDuplicate: true},
                },
            },
        });
        this.addNoteUuidTypeQueue1.push(fields["uuid-type"]);
        this.addNoteActionsQueue2.push({
            action: "updateNoteFields",
            params: {
                note: {
                    deckName: deckName,
                    modelName: modelName,
                    fields: fields,
                },
            },
        });
        this.addNoteUuidTypeQueue2.push(fields["uuid-type"]);
    }

    updateNote(
        ankiId: number,
        deckName: string,
        modelName: string,
        fields,
        tags: string[],
    ): void {
        const noteinfo = this.noteInfoMap.get(ankiId);
        const cards = noteinfo.cards;
        if (deckName != noteinfo.deck) {
            this.updateNoteActionsQueue.push({
                action: "changeDeck",
                params: {cards: cards, deck: deckName},
            });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }

        // Remove all old unneeded tags and add new ones
        let to_remove_tags = _.difference(noteinfo.tags, tags);
        to_remove_tags = to_remove_tags.filter((tag) => tag.toLowerCase() != "leech"); // Don't remove leech tag. It has a special meaning in Anki.
        to_remove_tags = to_remove_tags.filter((tag) => tag.toLowerCase() != "marked"); // Same for 'marked' tag
        const to_add_tags = _.difference(tags, noteinfo.tags);
        for (const tag of to_remove_tags) {
            this.updateNoteActionsQueue.push({
                action: "removeTags",
                params: {notes: [ankiId], tags: tag},
            });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }
        for (const tag of to_add_tags) {
            this.updateNoteActionsQueue.push({
                action: "addTags",
                params: {notes: [ankiId], tags: tag},
            });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }

        let needsFieldUpdate = false;
        for (const key in fields) {
            if (noteinfo.fields[key].value != fields[key]) {
                if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
                    console.log(
                        "Difference found:",
                        key,
                        noteinfo.fields[key].value,
                        fields[key],
                    );
                needsFieldUpdate = true;
                break;
            }
        }
        if (needsFieldUpdate) {
            this.updateNoteActionsQueue.push({
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
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }
    }

    deleteNote(ankiId: number): void {
        this.deleteNoteActionsQueue.push({
            action: "deleteNotes",
            params: {notes: [ankiId]},
        });
        this.deleteNoteAnkiIdQueue.push(ankiId);
    }

    storeAsset(filename: string, path: string): void {
        this.storeAssetActionsQueue.push({
            action: "storeMediaFile",
            params: {filename, path},
        });
    }

    async execute(operation: string): Promise<any> {
        let result = [];
        switch (operation) {
            case "addNotes": // Returns [ankiIdUUIDPairs, resut of sub-operations] pair
                if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
                    console.log(this.addNoteUuidTypeQueue2);
                // Create notes with dummy content to avoid error
                const result1 = await AnkiConnect.invoke("multi", {
                    actions: this.addNoteActionsQueue1,
                });
                for (let i = 0; i < result1.length; i++) {
                    if (result1[i] == null) result1[i] = {};
                    _.extend(result1[i], {
                        "uuid-type": this.addNoteUuidTypeQueue1[i],
                    });
                }

                // Get anki id of newly added notes
                const getankiIdActionsQueue = [];
                for (const uuidType of this.addNoteUuidTypeQueue2) {
                    getankiIdActionsQueue.push({
                        action: "findNotes",
                        params: {query: `uuid-type:${uuidType}`},
                    });
                }
                const ankiIdActionsQueueRes = await AnkiConnect.invoke("multi", {
                    actions: getankiIdActionsQueue,
                });
                const ankiId = [];
                const ankiIdUUIDTypePairs = [];
                for (let i = 0; i < ankiIdActionsQueueRes.length; i++) {
                    if (ankiIdActionsQueueRes[i] == null) ankiIdActionsQueueRes[i] = [];
                    ankiId[i] = ankiIdActionsQueueRes[i][0];
                    ankiIdUUIDTypePairs.push({
                        "uuid-type": this.addNoteUuidTypeQueue2[i],
                        ankiId: ankiIdActionsQueueRes[i][0],
                    });
                }
                // Update note fields
                for (let i = 0; i < this.addNoteActionsQueue2.length; i++) {
                    if (ankiId[i] == null) this.addNoteActionsQueue2[i] = {};
                    this.addNoteActionsQueue2[i].params.note.id = ankiId[i];
                }
                const result2 = await AnkiConnect.invoke("multi", {
                    actions: this.addNoteActionsQueue2,
                });
                for (let i = 0; i < result2.length; i++) {
                    if (result2[i] == null) result1[i] = {};
                    _.extend(result2[i], {
                        "uuid-type": this.addNoteUuidTypeQueue2[i],
                    });
                }

                // Merge results
                result = [ankiIdUUIDTypePairs, [...result1, ...result2]];
                this.addNoteActionsQueue1 = [];
                this.addNoteUuidTypeQueue1 = [];
                this.addNoteActionsQueue2 = [];
                this.addNoteUuidTypeQueue2 = [];
                break;
            case "updateNotes": // Returns resut of sub-operations
                if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
                    console.log(this.updateNoteActionsQueue);
                result = await AnkiConnect.invoke("multi", {
                    actions: this.updateNoteActionsQueue,
                });
                if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
                    console.log(result);
                for (let i = 0; i < result.length; i++) {
                    if (result[i] == null) result[i] = {};
                    _.extend(result[i], {
                        "uuid-type": this.updateNoteUuidTypeQueue[i],
                    });
                }
                this.updateNoteActionsQueue = [];
                this.updateNoteUuidTypeQueue = [];
                break;
            case "deleteNotes": // Returns resut of sub-operations
                if (logseq.settings.debug.includes("LazyAnkiNoteManager.ts"))
                    console.log(this.deleteNoteAnkiIdQueue);
                result = await AnkiConnect.invoke("multi", {
                    actions: this.deleteNoteActionsQueue,
                });
                for (let i = 0; i < result.length; i++) {
                    if (result[i] == null) result[i] = {};
                    _.extend(result[i], {
                        ankiId: this.deleteNoteAnkiIdQueue[i],
                    });
                }
                this.deleteNoteActionsQueue = [];
                this.deleteNoteAnkiIdQueue = [];
                break;
            case "storeAssets": // Returns nothing
                try {
                    const uniqueStoreAssetActionsQueue = _.uniqBy(
                        this.storeAssetActionsQueue,
                        "params.filename",
                    );
                    let finalStoreAssetActionsQueue = [];
                    const maxBatchSize = 10;
                    while (uniqueStoreAssetActionsQueue.length > 0) {
                        let batchStoreAssetActionsQueue = [];
                        while (
                            batchStoreAssetActionsQueue.length < maxBatchSize &&
                            uniqueStoreAssetActionsQueue.length > 0
                        ) {
                            batchStoreAssetActionsQueue.push(
                                uniqueStoreAssetActionsQueue.pop(),
                            );
                        }
                        const retriveAnkiAssetContentActionQueue =
                            batchStoreAssetActionsQueue.map((action) => {
                                return {
                                    action: "retrieveMediaFile",
                                    params: {
                                        filename: action.params.filename,
                                    },
                                };
                            });
                        const getBase64Image = async (url) => {
                            const response = await window.parent.fetch(url);
                            const blob = await response.blob();
                            const reader = new FileReader();
                            await new Promise((resolve, reject) => {
                                reader.onload = resolve;
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            return (reader.result as string).replace(/^data:.+;base64,/, "");
                        };
                        const ankiAssetContent = await AnkiConnect.invoke("multi", {
                            actions: retriveAnkiAssetContentActionQueue,
                        });
                        batchStoreAssetActionsQueue = await Promise.all(
                            batchStoreAssetActionsQueue.map(async (action, idx) => {
                                if (action.params.path != null) {
                                    let fimg = "";
                                    try {
                                        fimg = await getBase64Image(action.params.path);
                                    } catch {}
                                    if (fimg != "" && fimg != "data:" && fimg != null) {
                                        if (
                                            ankiAssetContent[idx] != null &&
                                            ankiAssetContent[idx] != false &&
                                            ankiAssetContent[idx] == fimg
                                        )
                                            return null;
                                        delete action.params.path;
                                        action.params.data = fimg;
                                        return action;
                                    } else return action;
                                }
                                return action;
                            }),
                        );
                        batchStoreAssetActionsQueue = batchStoreAssetActionsQueue.filter(
                            (action) => action != null,
                        );
                        finalStoreAssetActionsQueue = [
                            ...finalStoreAssetActionsQueue,
                            ...batchStoreAssetActionsQueue,
                        ];
                        result = [
                            ...result,
                            ...(await AnkiConnect.invoke("multi", {
                                actions: batchStoreAssetActionsQueue,
                            })),
                        ];
                    }
                    this.storeAssetActionsQueue = [];
                    console.log("Assets Stored:", finalStoreAssetActionsQueue, result);
                } catch (e) {
                    console.log(e);
                }
                break;
        }
        return result;
    }
}
