import '@logseq/libs'
import * as AnkiConnect from './anki-connect/AnkiConnect';
import { LazyAnkiNoteManager } from './anki-connect/LazyAnkiNoteManager';
import { template_front, template_back, template_files } from './templates/AnkiCardTemplates';
import { Note } from './notes/Note';
import { ClozeNote } from './notes/ClozeNote';
import { MultilineCardNote } from './notes/MultilineCardNote';
import _ from 'lodash';
import { get_better_error_msg, confirm } from './utils';
import path from 'path';
import { MD_PROPERTIES_REGEXP } from './constants';
import { convertToHTMLFile } from './converter/CachedConverter';

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
        console.log(`%cStarting Logseq to Anki Sync V2.6.2 for graph ${this.graphName}`, 'color: green; font-size: 1.5em;');

        // -- Request Access --
        await AnkiConnect.requestPermission();

        // -- Create models if it doesn't exists --
        await AnkiConnect.createModel(this.modelName, ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"], template_front, template_back, template_files);

        // -- Prepare Anki Note Manager --
        let ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
        await ankiNoteManager.init();
        Note.setAnkiNoteManager(ankiNoteManager);
        
        // -- Get the notes that are to be synced from logseq --
        let notes : Array<Note> = [...(await ClozeNote.getNotesFromLogseqBlocks()), ...(await MultilineCardNote.getNotesFromLogseqBlocks())];
        for (let note of notes) { // Force persistance of note's logseq block uuid accross re-index by adding id property to block in logseq
            if (!note.properties["id"]) { try { logseq.Editor.upsertBlockProperty(note.uuid, "id", note.uuid); } catch (e) { console.error(e); } }
        }
        console.log("Notes:", notes);

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
                let [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(note);
                // Add assets
                const graphPath = (await logseq.App.getCurrentGraph()).path;
                assets.forEach(asset => {
                    ankiNoteManager.storeAsset(encodeURIComponent(asset), path.join(graphPath, path.resolve(asset)))
                });
                // Create note
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

        ankiNoteManager.execute("storeAssets").then((subOperationResults) => {
            for (let subOperationResult of subOperationResults) {
                if (subOperationResult != null && subOperationResult.error != null) {
                    console.error(subOperationResult.error);
                }
            }
        });
    }

    private async updateNotes(toUpdateNotes: Note[], failedUpdated: Set<any>, ankiNoteManager: LazyAnkiNoteManager): Promise<void> {
        for (let note of toUpdateNotes) {
            try {
                let [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(note);
                // Add assets
                const graphPath = (await logseq.App.getCurrentGraph()).path;
                assets.forEach(asset => {
                    ankiNoteManager.storeAsset(encodeURIComponent(asset), path.join(graphPath, path.resolve(asset)))
                });
                // Update note
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

        ankiNoteManager.execute("storeAssets").then((subOperationResults) => {
            for (let subOperationResult of subOperationResults) {
                if (subOperationResult != null && subOperationResult.error != null) {
                    console.error(subOperationResult.error);
                }
            }
        });
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

    private async parseNote(note: Note): Promise<[string, Set<string>, string, string, string[], string]> {
        let {html, assets} = await note.addClozes().convertToHtmlFile();
        
        if(logseq.settings.includeParentContent) {
            let newHtml = "";
            let parentBlocks = []; 
            let parentID = (await logseq.Editor.getBlock(note.uuid)).parent.id;
            let parent;
            while ((parent = await logseq.Editor.getBlock(parentID)) != null) {
                parentBlocks.push({content:parent.content.replaceAll(MD_PROPERTIES_REGEXP, ""), format:parent.format, uuid:parent.uuid});
                parentID = parent.parent.id;
            }
            for await (const parentBlock of parentBlocks.reverse()) {
                newHtml += `<ul class="children-list"><li class="children">${(await convertToHTMLFile(parentBlock.content, parentBlock.format)).html}`;
            };
            newHtml += `<ul class="children-list"><li class="children">${html}</li></ul>`;
            parentBlocks.reverse().forEach(parentBlock => {
                newHtml += `</li></ul>`;
            });
            html = newHtml;
        }

        // Parse deck using logic described at https://github.com/debanjandhar12/logseq-anki-sync/wiki/How-to-set-or-change-the-deck-for-cards%3F
        let deck: any = _.get(note, 'properties.deck') || _.get(note, 'page.properties.deck') || "Default";
        try {
            let parentID = note.uuid;
            let parent;
            while ((parent = await logseq.App.getBlock(parentID)) != null) {
                if(_.get(parent, 'properties.deck') != null){
                    deck = _.get(parent, 'properties.deck');
                    break;
                }
                parentID = parent.parent.id;
            }
        } catch (e) {
            console.error(e);
        }
        if (typeof deck != "string") deck = deck[0];
        deck = deck.replace(/\//g, "::");
        if(deck == "Default" && _.get(note, 'page.properties.title') != null && _.get(note, 'page.properties.title').includes("/")) deck = _.get(note, 'page.properties.title').split("/").slice(0, -1).join("::");
        
        // Parse breadcrumb
        let breadcrumb = `<a href="logseq://graph/${encodeURIComponent(this.graphName)}?page=${encodeURIComponent(note.page.originalName)}" title="${note.page.originalName}">${note.page.originalName}</a>`;
        if(logseq.settings.breadcrumbDisplay == "Show Page name and parent blocks context") {
            try {
                let parentBlocks = []; 
                let parentID = (await logseq.App.getBlock(note.uuid)).parent.id;
                let parent;
                while ((parent = await logseq.App.getBlock(parentID)) != null) {
                    parentBlocks.push({content:parent.content.replaceAll(MD_PROPERTIES_REGEXP, ""), uuid:parent.uuid});
                    parentID = parent.parent.id;
                }
                while(parentBlocks.length > 0) {
                    let parentBlock = parentBlocks.pop();
                    let parentBlockContentFirstLine = parentBlock.content.split("\n")[0];
                    breadcrumb += ` > <a href="logseq://graph/${encodeURIComponent(this.graphName)}?block-id=${encodeURIComponent(parentBlock.uuid)}" title="${parentBlock.content}">${parentBlockContentFirstLine}</a>`;
                }
            } catch (e) {
                console.error(e);
            }
        }

        let tags = [...(_.get(note, 'properties.tags') || []), ...(_.get(note, 'page.properties.tags') || [])];
        let extra = _.get(note, 'properties.extra') || _.get(note, 'page.properties.extra') || "";
        if (Array.isArray(extra)) extra = extra.join(" ");

        return [html, assets, deck, breadcrumb, tags, extra];
    }
}