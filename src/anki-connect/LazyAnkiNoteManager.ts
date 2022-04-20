import * as AnkiConnect from './AnkiConnect';
import _ from 'lodash';
import '@logseq/libs'

export class LazyAnkiNoteManager {
    public modelName: string;
    public noteInfoMap: Map<any,any> = new Map();
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
    }

    async buildNoteInfoMap(modelName: string): Promise<any> {
        let result = await AnkiConnect.query(`note:${modelName}`);
        let notes = await AnkiConnect.invoke("notesInfo", { "notes": result });
        for(let note of notes) {
            this.noteInfoMap.set(note.noteId, note);
        }
        if(logseq.settings.syncDebug) console.debug(this.noteInfoMap);
    }

    addNote(deckName: string, modelName: string, fields, tags: string[]): void {
        this.addNoteActionsQueue1.push({"action": "createDeck", "params": { "deck": deckName } });
        this.addNoteUuidTypeQueue1.push(fields["uuid-type"]);
        let cloze_id = _.get(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g.exec(fields["Text"]), 2) || 1;
        this.addNoteActionsQueue1.push({"action": "addNote", "params": 
        { "note": { "modelName": modelName, "deckName": deckName, "fields": { ...fields, "Text": `{{c${cloze_id}:: placeholder}}`}, "tags": tags, "options": { "allowDuplicate": true} } } 
        });
        this.addNoteUuidTypeQueue1.push(fields["uuid-type"]);
        this.addNoteActionsQueue2.push({"action": "updateNoteFields", "params": { "note": { "deckName": deckName, "modelName": modelName, "fields": fields } } });
        this.addNoteUuidTypeQueue2.push(fields["uuid-type"]);
    }

    updateNote(ankiId: number, deckName: string, modelName: string, fields, tags: string[]): void {
        let noteinfo = this.noteInfoMap.get(ankiId);
        let cards = noteinfo.cards;
        this.updateNoteActionsQueue.push({"action": "changeDeck", "params": { "cards": cards, "deck": deckName }});
        this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);

        // Remove all old unneeded tags and add new ones
        tags = tags.map(tag => tag.replace(/\s/g, "_")); // Anki doesn't like spaces in tags
        let to_remove_tags = _.difference(noteinfo.tags, tags);
        let to_add_tags = _.difference(tags, noteinfo.tags);
        for (let tag of to_remove_tags){
            this.updateNoteActionsQueue.push({"action": "removeTags", "params": { "notes": [ankiId], "tags": tag } });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }
        for (let tag of to_add_tags) {
            this.updateNoteActionsQueue.push({ "action": "addTags", "params": { "notes": [ankiId], "tags": tag } });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }

        let needsFieldUpdate = false;
        for (let key in fields) {
            if (noteinfo.fields[key].value != fields[key]) {
                if(logseq.settings.syncDebug) console.log("Difference found:", key, noteinfo.fields[key].value, fields[key]);
                needsFieldUpdate = true;
                break;
            }
        }
        if(needsFieldUpdate) {
            this.updateNoteActionsQueue.push({"action": "updateNoteFields", "params": { "note": { id: ankiId, "deckName": deckName, "modelName": modelName, "fields": fields } } });
            this.updateNoteUuidTypeQueue.push(fields["uuid-type"]);
        }
    }

    deleteNote(ankiId: number): void {
        this.deleteNoteActionsQueue.push({"action": "deleteNotes", "params": { "notes": [ankiId] } });
        this.deleteNoteAnkiIdQueue.push(ankiId);
    }

    storeAsset(filename: string, path: string): void {
        this.storeAssetActionsQueue.push({"action": "storeMediaFile", "params": { filename, path } });
    }

    async execute(operation: string): Promise<any> {
        let result = [];
        switch (operation) {
            case "addNotes":    // Returns [ankiIdUUIDPairs, resut of sub-operations] pair
                if(logseq.settings.syncDebug) console.log(this.addNoteUuidTypeQueue2);
                // Create notes with dummy content to avoid error
                let result1 = await AnkiConnect.invoke("multi", { "actions": this.addNoteActionsQueue1 });
                for (let i = 0; i < result1.length; i++) {
                    if (result1[i] == null) result1[i] = {};
                    _.extend(result1[i], { "uuid-type": this.addNoteUuidTypeQueue1[i] });
                }

                // Get anki id of newly added notes
                let getankiIdActionsQueue = [];
                for(let uuidType of this.addNoteUuidTypeQueue2) {
                    getankiIdActionsQueue.push({ "action": "findNotes", "params": { "query": `uuid-type:${uuidType}` } });
                }
                let ankiIdActionsQueueRes = await AnkiConnect.invoke("multi", { "actions":  getankiIdActionsQueue});
                let ankiId = [];
                let ankiIdUUIDTypePairs = [];
                for (let i = 0; i < ankiIdActionsQueueRes.length; i++) {
                    if (ankiIdActionsQueueRes[i] == null)
                        ankiIdActionsQueueRes[i] = [];
                    ankiId[i] = ankiIdActionsQueueRes[i][0];
                    ankiIdUUIDTypePairs.push({ "uuid-type": this.addNoteUuidTypeQueue2[i], "ankiId": ankiIdActionsQueueRes[i][0] });
                }
                // Update note fields
                for(let i = 0; i < this.addNoteActionsQueue2.length; i++) {
                    if(ankiId[i] == null) this.addNoteActionsQueue2[i] = {};
                    this.addNoteActionsQueue2[i].params.note.id = ankiId[i];
                }
                let result2 = await AnkiConnect.invoke("multi", { "actions": this.addNoteActionsQueue2 });
                for (let i = 0; i < result2.length; i++) {
                    if (result2[i] == null) result1[i] = {};
                    _.extend(result2[i], { "uuid-type": this.addNoteUuidTypeQueue2[i] });
                }

                // Merge results
                result = [ankiIdUUIDTypePairs, [...result1, ...result2]];
                this.addNoteActionsQueue1 = [];
                this.addNoteUuidTypeQueue1 = [];
                this.addNoteActionsQueue2 = [];
                this.addNoteUuidTypeQueue2 = [];
                break;
            case "updateNotes": // Returns resut of sub-operations
                if(logseq.settings.syncDebug) console.log(this.updateNoteUuidTypeQueue);
                result = await AnkiConnect.invoke("multi", { "actions": this.updateNoteActionsQueue });
                for (let i = 0; i < result.length; i++) {
                    if (result[i] == null) result[i] = {};
                    _.extend(result[i], { "uuid-type": this.updateNoteUuidTypeQueue[i] });
                }
                this.updateNoteActionsQueue = [];
                this.updateNoteUuidTypeQueue = [];
                break;
            case "deleteNotes": // Returns resut of sub-operations
                if(logseq.settings.syncDebug) console.log(this.deleteNoteAnkiIdQueue);
                result = await AnkiConnect.invoke("multi", { "actions": this.deleteNoteActionsQueue });
                for (let i = 0; i < result.length; i++) {
                    if (result[i] == null) result[i] = {};
                    _.extend(result[i], { "ankiId": this.deleteNoteAnkiIdQueue[i] });
                }
                this.deleteNoteActionsQueue = [];
                this.deleteNoteAnkiIdQueue = [];
                break;
            case "storeAssets": // Returns nothing
                try{
                    this.storeAssetActionsQueue = _.uniqBy(this.storeAssetActionsQueue, 'params.filename');
                    result = await AnkiConnect.invoke("multi", { "actions": this.storeAssetActionsQueue });
                    console.log("Assets Stored:", result);
                }
                catch(e){ console.log(e); }
                this.storeAssetActionsQueue = [];
                break;
        }
        return result;
    }
}