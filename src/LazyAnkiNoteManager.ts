import * as AnkiConnect from './AnkiConnect';
import _ from 'lodash';

export class LazyAnkiNoteManager {
    public modelName: string;
    public noteInfoMap: Map<any,any> = new Map();
    private updateNoteQueue: Array<any> = [];
    private deleteNoteQueue: Array<any> = [];

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
        console.log(this.noteInfoMap);
    }

    async addNote(deckName: string, modelName: string, fields, tags: string[]): Promise<any> {
        let r; // Bug Fix: Await doesnt work proerly without this
        r = await AnkiConnect.createDeck(deckName); // Create Deck with name if it does not exists
    
        // Some versions of Anki doesnt allow to add notes without cloze
        // The trick below adds an empty note with a cloze block, and then overwites it to overcome the above problem.
        let cloze_id = _.get(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g.exec(fields["Text"]), 2) || 1;
        let ankiId = await AnkiConnect.invoke("addNote", { "note": { "modelName": modelName, "deckName": deckName, "fields": { ...fields, "Text": `{{c${cloze_id}:: placeholder}}` }, "tags": tags, "options": { "allowDuplicate": true } } });
        return await AnkiConnect.invoke("updateNoteFields", { "note": { id: ankiId, "deckName": deckName, "modelName": modelName, "fields": fields } });
    }

    updateNote(ankiId: number, deckName: string, modelName: string, fields, tags: string[]): void {
        let noteinfo = this.noteInfoMap.get(ankiId);
        let cards = noteinfo.cards;
        this.updateNoteQueue.push({"action": "changeDeck", "params": { "cards": cards, "deck": deckName }});
        
        // Remove all old tags and add new ones
        let to_remove_tags = _.difference(noteinfo.tags, tags);
        let to_add_tags = _.difference(tags, noteinfo.tags);
        for (let tag of to_remove_tags)
            this.updateNoteQueue.push({"action": "removeTags", "params": { "notes": [ankiId], "tags": tag } });
        for (let tag of to_add_tags)
            this.updateNoteQueue.push({ "action": "addTags", "params": { "notes": [ankiId], "tags": tag } });
        
            this.updateNoteQueue.push({"action": "updateNoteFields", "params": { "note": { id: ankiId, "deckName": deckName, "modelName": modelName, "fields": fields } } });
    }

    deleteNote(ankiId: number): void {
        this.deleteNoteQueue.push({"action": "deleteNotes", "params": { "notes": [ankiId] } });
    }

    async execute(operation: string): Promise<any> {
        let result = [];
        switch (operation) {
            case "updateNote":
                console.log(this.updateNoteQueue);
                result = await AnkiConnect.invoke("multi", { "actions": this.updateNoteQueue });
                console.log(result);
                this.updateNoteQueue = [];
                break;
            case "deleteNote":
                console.log(this.deleteNoteQueue);
                result = await AnkiConnect.invoke("multi", { "actions": this.deleteNoteQueue });
                this.deleteNoteQueue = [];
                console.log(result);
                break;
        }
        return result;
    }
}