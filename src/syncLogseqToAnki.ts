import '@logseq/libs'
import * as AnkiConnect from './anki-connect/AnkiConnect';
import { LazyAnkiNoteManager } from './anki-connect/LazyAnkiNoteManager';
import { template_front, template_back, template_files } from './templates/AnkiCardTemplates';
import { Note } from './notes/Note';
import { ClozeNote } from './notes/ClozeNote';
import { MultilineCardNote } from './notes/MultilineCardNote';
import _ from 'lodash';
import { get_better_error_msg, confirm } from './utils';

export class LogseqToAnkiSync {
    static isSyncing: boolean;
    graphName: string;
    modelName: string;

    public async sync(): Promise<void> {
        if (LogseqToAnkiSync.isSyncing) { console.log(`Syncing already in process...`); return; }
        LogseqToAnkiSync.isSyncing = true;
        try {
          await this.performSync();
        } 
        catch (e) {
          logseq.App.showMsg(get_better_error_msg(e.toString()), 'warning');
          console.error(e);
        } 
        LogseqToAnkiSync.isSyncing = false;
    }

    private async performSync(): Promise<void> {
        this.graphName = _.get(await logseq.App.getCurrentGraph(), 'name') || 'Default';
        this.modelName = `${this.graphName}Model`.replace(/\s/g, "_");
        logseq.App.showMsg(`Starting Logseq to Anki Sync for graph ${this.graphName}`);
        console.log(`%cStarting Logseq to Anki Sync for graph ${this.graphName}`, 'color: green; font-size: 1.5em;');

        // -- Request Access --
        await AnkiConnect.requestPermission();
        
        // -- Create models if it doesn't exists --
        await AnkiConnect.createModel(this.modelName, ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"], template_front, template_back, template_files);

        // -- Get the notes that are to be synced from logseq --
        let notes : Array<Note> = [...(await ClozeNote.getNotesFromLogseqBlocks()), ...(await MultilineCardNote.getNotesFromLogseqBlocks())];
        for (let note of notes) { // Force persistance of note's logseq block uuid accross re-index by adding id property to block in logseq
            if (!note.properties["id"]) { logseq.Editor.upsertBlockProperty(note.uuid, "id", note.uuid); }
        }
        console.log("Notes:", notes);

        // -- Prepare Anki Note Manager --
        let ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
        await ankiNoteManager.init();
        Note.setAnkiNoteManager(ankiNoteManager);

        // -- Declare some variables to keep track of different operations performed --
        let failedCreated: Set<string> = new Set(), failedUpdated: Set<string> = new Set(), failedDeleted: Set<string> = new Set();
        let toCreateNotes = new Array<Note>(), toUpdateNotes = new Array<Note>(), toDeleteNotes = new Array<number>();
        for (let note of notes) {
            let ankiId = await note.getAnkiId();
            if (ankiId == null || isNaN(ankiId)) toCreateNotes.push(note);
            else toUpdateNotes.push(note);
        }
        let noteAnkiIds: Array<number> = await Promise.all(notes.map(async block => await block.getAnkiId()));  // Flatten current logseq block's anki ids
        let AnkiIds: Array<number> = [...ankiNoteManager.noteInfoMap.keys()]; 
        for(let ankiId of AnkiIds) {
            if(!noteAnkiIds.includes(ankiId)) {
               toDeleteNotes.push(ankiId);
            }
        }

        // -- Prompt the user what actions are going to be performed --
        let confirm_msg = `<b>The logseq to anki sync plugin will attempt to perform the following actions:</b><br/>Create ${toCreateNotes.length} new anki notes<br/>Update ${toUpdateNotes.length} existing anki notes<br/>Delete ${toDeleteNotes.length} anki notes<br/><br/>Are you sure you want to coninue?`;
        if (!(await confirm(confirm_msg))) { console.log("Sync Aborted by user!"); return; }
        
        // -- Sync --
        let start_time = performance.now();
        await this.createNotes(toCreateNotes, failedCreated, ankiNoteManager);
        await this.updateNotes(toUpdateNotes, failedUpdated, ankiNoteManager);
        await this.deleteNotes(toDeleteNotes, ankiNoteManager, failedDeleted);
        await AnkiConnect.invoke("reloadCollection", {});

        // -- Show Result / Summery --
        let summery = `Sync Completed! Created Blocks: ${toCreateNotes.length - failedCreated.size} \n Updated Blocks: ${toUpdateNotes.length - failedUpdated.size} \n Deleted Blocks: ${toDeleteNotes.length - failedDeleted.size}`;
        let status = 'success';
        if (failedCreated.size > 0) summery += `\nFailed Created: ${failedCreated.size} `;
        if (failedUpdated.size > 0) summery += `\nFailed Updated: ${failedUpdated.size} `;
        if (failedDeleted.size > 0) summery += `\nFailed Deleted: ${failedDeleted.size} `;
        if (failedCreated.size > 0 || failedUpdated.size > 0 || failedDeleted.size > 0) status = 'warning';
        logseq.App.showMsg(summery, status);
        console.log(summery);
        if (failedCreated.size > 0) console.log("\nFailed Created:", failedCreated);
        if (failedUpdated.size > 0) console.log("\nFailed Updated:", failedUpdated);
        if (failedDeleted.size > 0) console.log("\nFailed Deleted:", failedDeleted);
        console.log("syncLogseqToAnki() Time Taken:", (performance.now() - start_time).toFixed(2), "ms");
    }

    private async createNotes(toCreateNotes: Note[], failedCreated: Set<any>, ankiNoteManager: LazyAnkiNoteManager): Promise<void> {
        for (let note of toCreateNotes) {
            try {
                let html = (await note.addClozes().convertToHtml()).getContent();
                let deck: any = _.get(note, 'properties.deck') || _.get(note, 'page.properties.deck') || "Default";
                if (typeof deck != "string") deck = deck[0];
                let breadcrumb = `<a href="#">${note.page.originalName}</a>`;
                let tags = [...(_.get(note, 'properties.tags') || []), ...(_.get(note, 'page.properties.tags') || [])];
                let extra = _.get(note, 'properties.extra') || _.get(note, 'page.properties.extra') || "";
                if (Array.isArray(extra)) extra = extra.join(" ");
                let ankiId = note.getAnkiId();
                ankiNoteManager.addNote(deck, this.modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
            } catch (e) {
                console.error(e); failedCreated.add(`${note.uuid}-${note.type}`);
            }
        }

        let [addedNoteAnkiIdUUIDPairs, subOperationResults] = await ankiNoteManager.execute("addNotes");
        for (let addedNoteAnkiIdUUIDPair of addedNoteAnkiIdUUIDPairs) { // update ankiId of added blocks
            let uuidtype = addedNoteAnkiIdUUIDPair["uuid-type"];
            let uuid = uuidtype.split("-").slice(0, -1).join("-");
            let type = uuidtype.split("-").slice(-1)[0];
            let note = _.find(toCreateNotes, { "uuid": uuid, "type": type });
            note["ankiId"] = addedNoteAnkiIdUUIDPair["ankiId"];
            console.log(note);
        }

        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedCreated.add(subOperationResult["uuid-type"]);
            }
        }
    }

    private async updateNotes(toUpdateNotes: Note[], failedUpdated: Set<any>, ankiNoteManager: LazyAnkiNoteManager): Promise<void> {
        for (let note of toUpdateNotes) {
            try {
                let html = (await note.addClozes().convertToHtml()).getContent();
                let deck: any = _.get(note, 'properties.deck') || _.get(note, 'page.properties.deck') || "Default";
                if (typeof deck != "string") deck = deck[0];
                let breadcrumb = `<a href="#">${note.page.originalName}</a>`;
                let tags = [...(_.get(note, 'properties.tags') || []), ...(_.get(note, 'page.properties.tags') || [])];
                let extra = _.get(note, 'properties.extra') || _.get(note, 'page.properties.extra') || "";
                if (Array.isArray(extra)) extra = extra.join(" ");
                let ankiId = note.getAnkiId();
                ankiNoteManager.updateNote(ankiId, deck, this.modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
            } catch (e) {
                console.error(e); failedUpdated.add(`${note.uuid}-${note.type}`);
            }
        }

        let subOperationResults = await ankiNoteManager.execute("updateNotes");
        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedUpdated.add(subOperationResult["uuid-type"]);
            }
        }
    }

    private async deleteNotes(toDeleteNotes: number[], ankiNoteManager: LazyAnkiNoteManager, failedDeleted) {
        for(let ankiId of toDeleteNotes){
            ankiNoteManager.deleteNote(ankiId);
        }
        let subOperationResults = await ankiNoteManager.execute("deleteNotes");
        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedDeleted.add(subOperationResult.error.ankiId);
            }
        }
    }
}