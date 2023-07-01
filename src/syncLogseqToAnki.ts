import '@logseq/libs'
import * as AnkiConnect from './anki-connect/AnkiConnect';
import { LazyAnkiNoteManager } from './anki-connect/LazyAnkiNoteManager';
import { template_front, template_back, template_files } from './templates/AnkiCardTemplates';
import { Note } from './notes/Note';
import { ClozeNote } from './notes/ClozeNote';
import { MultilineCardNote } from './notes/MultilineCardNote';
import _ from 'lodash';
import {escapeClozeAndSecoundBrace, get_better_error_msg, getCaseInsensitive, sortAsync} from './utils/utils';
import path from 'path-browserify';
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from './constants';
import { convertToHTMLFile } from './converter/Converter';
import { LogseqProxy } from './logseq/LogseqProxy';
import pkg from '../package.json';
import { SwiftArrowNote } from './notes/SwiftArrowNote';
import {ProgressNotification} from "./ui/ProgressNotification";
import {Confirm} from "./ui/Confirm";
import {ImageOcclusionNote} from "./notes/ImageOcclusionNote";
import NoteHashCalculator from "./notes/NoteHashCalculator";
import {cancelable, CancelablePromise} from 'cancelable-promise';
import {DepGraph} from "dependency-graph";
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
          logseq.UI.showMsg(get_better_error_msg(e.toString()), 'warning', {timeout: 4000});
          logseq.provideUI({ key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`, template: `` });
          console.error(e);
        }
        LogseqToAnkiSync.isSyncing = false;
    }

    private async performSync(): Promise<void> {
        this.graphName = _.get(await logseq.App.getCurrentGraph(), 'name') || 'Default';
        this.modelName = `${this.graphName}Model`.replace(/\s/g, "_");
        logseq.UI.showMsg(`Starting Logseq to Anki Sync for graph ${this.graphName}`);
        console.log(`%cStarting Logseq to Anki Sync V${pkg.version} for graph ${this.graphName}`, 'color: green; font-size: 1.5em;');

        // -- Request Access --
        await AnkiConnect.requestPermission();

        // -- Create models if it doesn't exists --
        await AnkiConnect.createModel(this.modelName, ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"], template_front, template_back, template_files);

        // -- Prepare Anki Note Manager --
        let ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
        await ankiNoteManager.init();
        Note.setAnkiNoteManager(ankiNoteManager);

        // -- Get the notes that are to be synced from logseq --
        let scanProgress = new ProgressNotification('Scanning Logseq Graph:', 4);
        let notes : Array<Note> = [];
        notes = await ClozeNote.getNotesFromLogseqBlocks();
        scanProgress.increment();

        const swiftArrowNotes = await SwiftArrowNote.getNotesFromLogseqBlocks();
        const swiftArrowNoteMap: Record<string, SwiftArrowNote> = swiftArrowNotes.reduce((acc, note) => ({ ...acc, [note.uuid]: note }), {});
        notes = notes.map((note) => swiftArrowNoteMap[note.uuid] ? swiftArrowNoteMap[note.uuid] : note);
        scanProgress.increment();

        notes = [...notes, ...(await ImageOcclusionNote.getNotesFromLogseqBlocks())]; scanProgress.increment();

        const multilineCardNotes = await MultilineCardNote.getNotesFromLogseqBlocks(notes);
        const flatChildren = (father: any) => {
            if (father.children?.length <= 0) {
                return [father];
            }
            let allChildren = [];
            for (const child of father.children) {
                allChildren = [...allChildren, ...flatChildren(child)];
            }
            return allChildren;
        };
        const flatChildrenList =  multilineCardNotes.map(note => flatChildren(note)).reduce((acc, cur) => ([...acc, ...cur]), []);
        const flatChildrenSet = new Set(flatChildrenList.map(child => child.uuid));
        notes = notes.filter(note => !flatChildrenSet.has(note.uuid));
        notes = [...notes, ...multilineCardNotes];
        scanProgress.increment();

        for (let note of notes) { // Force persistance of note's logseq block uuid accross re-index by adding id property to block in logseq
            if (!note.properties["id"]) { try { LogseqProxy.Editor.upsertBlockProperty(note.uuid, "id", note.uuid); } catch (e) { console.error(e); } }
        }
        notes = await sortAsync(notes, async (a) => {
            return (await LogseqProxy.Editor.getBlock(a.uuid)).id; // Sort by db/id
        });
        //scanProgress.increment();
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
        // Perform caching while user is reading the prompt
        const buildNoteHashes = new CancelablePromise(async (resolve, reject, onCancel) => {
            for(let note of notes) {
                await NoteHashCalculator.getHash(note, ["", [], "", "", [], ""]);
                if(buildNoteHashes.isCanceled()) break;
            }
        });
        // Prompt the user
        // @ts-ignore
        window.parent.AnkiConnect = AnkiConnect;    // Make AnkiConnect available to the confirm dialog
        let confirm_msg = `<div><b>The logseq to anki sync plugin will attempt to perform the following actions:</b></div>
                            <div>Create ${toCreateNotes.length} new anki notes</div>
                            <div>Update ${toUpdateNotes.length} existing anki notes</div>
                            <div>Delete ${toDeleteNotes.length != 0 ? `<span class="text-red-600">${toDeleteNotes.length}</span>` : toDeleteNotes.length} anki notes ${toDeleteNotes.length != 0 ? `<a style="color:red;" onMouseOver="this.style.color='darkred'" onMouseOut="this.style.color='red'" onclick="AnkiConnect.guiBrowse('nid:${toDeleteNotes.join(",")}')">(view notes in anki)</a>` : ``}<div><br/>
                            <div>Are you sure you want to continue?<div>`;
        let confirm_result = await Confirm(confirm_msg);
        // @ts-ignore
        window.parent.AnkiConnect = null; // Remove AnkiConnect from the global scope
        if (!confirm_result) { buildNoteHashes.cancel(); window.dispatchEvent(new Event('syncLogseqToAnkiComplete')); console.log("Sync Aborted by user!"); return; }
        if (toCreateNotes.length == 0 && toUpdateNotes.length == 0 && toDeleteNotes.length >= 10) { // Prompt the user again if they are about to delete a lot of notes
            let confirm_msg = `<b class="text-red-600">This will delete all your notes in anki that are generated from this graph.</b><br/>Are you sure you want to continue?`;
            if (!(await Confirm(confirm_msg))) { buildNoteHashes.cancel(); window.dispatchEvent(new Event('syncLogseqToAnkiComplete')); console.log("Sync Aborted by user!"); return;}
        }
        buildNoteHashes.cancel();

        // -- Sync --
        let start_time = performance.now();
        const tenPercent = Math.ceil((toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length) / 10);
        let syncProgress = new ProgressNotification('Syncing Logseq Notes to Anki:', toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length + (2 * (tenPercent)) + 1);
        await this.createNotes(toCreateNotes, failedCreated, ankiNoteManager, syncProgress);
        syncProgress.increment(tenPercent);
        await this.updateNotes(toUpdateNotes, failedUpdated, ankiNoteManager, syncProgress);
        syncProgress.increment(tenPercent);
        await this.deleteNotes(toDeleteNotes, failedDeleted, ankiNoteManager, syncProgress);
        syncProgress.increment();
        await AnkiConnect.invoke("reloadCollection", {});
        window.dispatchEvent(new Event('syncLogseqToAnkiComplete'));

        // -- Show Result / Summery --
        let summery = `Sync Completed! \n Created Blocks: ${toCreateNotes.length - failedCreated.size} \n Updated Blocks: ${toUpdateNotes.length - failedUpdated.size} \n Deleted Blocks: ${toDeleteNotes.length - failedDeleted.size}`;
        let status = 'success';
        if (failedCreated.size > 0) summery += `\nFailed Created: ${failedCreated.size} `;
        if (failedUpdated.size > 0) summery += `\nFailed Updated: ${failedUpdated.size} `;
        if (failedDeleted.size > 0) summery += `\nFailed Deleted: ${failedDeleted.size} `;
        if (failedCreated.size > 0 || failedUpdated.size > 0 || failedDeleted.size > 0) status = 'warning';
        logseq.UI.showMsg(summery, status, {timeout: status == 'success' ? 1200 : 4000});
        console.log(summery);
        if (failedCreated.size > 0) console.log("\nFailed Created:", failedCreated);
        if (failedUpdated.size > 0) console.log("\nFailed Updated:", failedUpdated);
        if (failedDeleted.size > 0) console.log("\nFailed Deleted:", failedDeleted);
        console.log("syncLogseqToAnki() Time Taken:", (performance.now() - start_time).toFixed(2), "ms");
    }

    private async createNotes(toCreateNotes: Note[], failedCreated: Set<any>, ankiNoteManager: LazyAnkiNoteManager, syncProgress: ProgressNotification): Promise<void> {
        for (let note of toCreateNotes) {
            try {
                let [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(note);
                let dependencyHash = await NoteHashCalculator.getHash(note, [html, Array.from(assets), deck, breadcrumb, tags, extra]);
                // Add assets
                const graphPath = (await logseq.App.getCurrentGraph()).path;
                assets.forEach(asset => {
                    ankiNoteManager.storeAsset(path.basename(asset), path.join(graphPath, path.resolve(asset)))
                });
                // Create note
                ankiNoteManager.addNote(deck, this.modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb, "Config": JSON.stringify({dependencyHash,assets:[...assets]}) }, tags);
            } catch (e) {
                console.error(e); failedCreated.add(`${note.uuid}-${note.type}`);
            }
            syncProgress.increment();
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

        subOperationResults = await ankiNoteManager.execute("addNotes");
        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
            }
        }
    }

    private async updateNotes(toUpdateNotes: Note[], failedUpdated: Set<any>, ankiNoteManager: LazyAnkiNoteManager, syncProgress: ProgressNotification): Promise<void> {
        const graphPath = (await logseq.App.getCurrentGraph()).path;
        for (let note of toUpdateNotes) {
            try {
                let ankiId = note.getAnkiId();
                // Calculate Dependency Hash - It is the hash of all dependencies of the note
                // (dependencies include related logseq blocks, related logseq pages, plugin version, current note content in anki etc)
                let ankiNodeInfo = ankiNoteManager.noteInfoMap.get(ankiId);
                let oldConfig = ((configString) => {
                    try { return JSON.parse(configString); }
                    catch (e) { return {}; }
                })(ankiNodeInfo.fields.Config.value);
                let [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags, oldExtra] = [ankiNodeInfo.fields.Text.value, oldConfig.assets, ankiNodeInfo.deck, ankiNodeInfo.fields.Breadcrumb.value, ankiNodeInfo.tags, ankiNodeInfo.fields.Extra.value];
                let dependencyHash = await NoteHashCalculator.getHash(note, [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags, oldExtra]);
                if(logseq.settings.skipOnDependencyHashMatch != true || oldConfig.dependencyHash != dependencyHash) { // Reparse Note + update assets + update                    // Parse Note
                    let [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(note);
                    dependencyHash = await NoteHashCalculator.getHash(note, [html, Array.from(assets), deck, breadcrumb, tags, extra]);
                    // Add or update assets
                    const graphPath = (await logseq.App.getCurrentGraph()).path;
                    assets.forEach(asset => {
                        ankiNoteManager.storeAsset(path.basename(asset), path.join(graphPath, path.resolve(asset)))
                    });
                    // Update note
                    if(logseq.settings.debug.includes("syncLogseqToAnki.ts")) console.log(`dependencyHash mismatch for note with id ${note.uuid}-${note.type}`);
                    ankiNoteManager.updateNote(ankiId, deck, this.modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb, "Config": JSON.stringify({dependencyHash,assets:[...assets]}) }, tags);
                }
                else { // Just update old assets
                    oldConfig.assets.forEach(asset => {
                        if(ankiNoteManager.mediaInfo.has(path.basename(asset))) return;
                        ankiNoteManager.storeAsset(path.basename(asset), path.join(graphPath, path.resolve(asset)))
                    });
                }
            } catch (e) {
                console.error(e); failedUpdated.add(`${note.uuid}-${note.type}`);
            }
            syncProgress.increment();
        }

        let subOperationResults = await ankiNoteManager.execute("updateNotes");
        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedUpdated.add(subOperationResult["uuid-type"]);
            }
        }

        subOperationResults = await ankiNoteManager.execute("storeAssets");
        for (let subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
            }
        }
    }

    private async deleteNotes(toDeleteNotes: number[], failedDeleted, ankiNoteManager: LazyAnkiNoteManager, syncProgress: ProgressNotification) {
        for(let ankiId of toDeleteNotes){
            ankiNoteManager.deleteNote(ankiId);
            syncProgress.increment();
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
        let {html, assets, tags } = await note.getClozedContentHTML();

        if(logseq.settings.includeParentContent) {
            let newHtml = "";
            let parentBlocks = [];
            let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
            let parent;
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                parentBlocks.push({content:escapeClozeAndSecoundBrace(parent.content), format:parent.format, uuid:parent.uuid});
                parentID = parent.parent.id;
            }
            for await (const parentBlock of parentBlocks.reverse()) {
                let parentBlockConverted = await convertToHTMLFile(parentBlock.content, parentBlock.format);
                parentBlockConverted.assets.forEach(asset => assets.add(asset));
                newHtml += `<ul class="children-list"><li class="children">${parentBlockConverted.html}`;
            };
            newHtml += `<ul class="children-list"><li class="children">${html}</li></ul>`;
            parentBlocks.reverse().forEach(parentBlock => {
                newHtml += `</li></ul>`;
            });
            html = newHtml;
        }

        // Parse deck using logic described at https://github.com/debanjandhar12/logseq-anki-sync/wiki/How-to-set-or-change-the-deck-for-cards%3F
        let deck: any = false;
        try {
            let parentID = note.uuid;
            let parent;
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                if(_.get(parent, 'properties.deck') != null){
                    deck = _.get(parent, 'properties.deck');
                    break;
                }
                parentID = parent.parent.id;
            }
        } catch (e) {
            console.error(e);
        }
        deck = deck || _.get(note, 'page.properties.deck');
        let shouldParseDeckFromNamespace = async () =>{
            if (logseq.settings.deckFromLogseqNamespace) return true;
            let rootPageName = _.get(note,'page.name').split("/")[0];
            if (_.get(note,'page.namespace.id') != null && _.get((await LogseqProxy.Editor.getPage(rootPageName)),"properties.parsens") == true)
                return true;
            return false;
        }
        deck = deck || ((await shouldParseDeckFromNamespace()) ? (_.get(note, 'page.originalName', '') || _.get(note, 'page.properties.title', '')).split("/").slice(0, -1).join("/") : false);
        deck = deck || logseq.settings.defaultDeck || "Default";
        if (typeof deck != "string") deck = deck[0];
        deck = deck.replace(/\//g, "::");

        // Parse breadcrumb
        let breadcrumb = ``;
        if (logseq.settings.breadcrumbDisplay.includes("Show Page name")) breadcrumb = `<a href="logseq://graph/${encodeURIComponent(this.graphName)}?page=${encodeURIComponent(note.page.originalName)}" title="${note.page.originalName}">${note.page.originalName}</a>`;
        if(logseq.settings.breadcrumbDisplay == "Show Page name and parent blocks context") {
            try {
                let parentBlocks = [];
                let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
                let parent;
                while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                    parentBlocks.push({content:parent.content.replaceAll(MD_PROPERTIES_REGEXP, "").replaceAll(ANKI_CLOZE_REGEXP, "$3"), uuid:parent.uuid});
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

        // Parse tags
        tags = [...Array.from(tags), ...getCaseInsensitive(note, 'properties.tags', []), ...getCaseInsensitive(note, 'page.properties.tags', [])];
        try {
            let parentID = note.uuid;
            let parent;
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                tags = [...tags, ...getCaseInsensitive(parent, 'properties.tags', [])];
                parentID = parent.parent.id;
            }
        } catch (e) {
            console.error(e);
        }
        tags = tags.map(tag => tag.replace(/\//g, "::"));
        tags = tags.map(tag => tag.replace(/\s/g, "_")); // Anki doesn't like spaces in tags
        tags = _.uniq(tags);
        tags = tags.filter(tag => {
            let otherTags = (tags as string[]).filter(otherTag => otherTag != tag);
            let otherTagsStartingWithThisName = otherTags.filter(otherTag => otherTag.startsWith(tag+"::"));
            return otherTagsStartingWithThisName.length == 0;
        });

        let extra = _.get(note, 'properties.extra') || _.get(note, 'page.properties.extra') || "";
        if (Array.isArray(extra)) extra = extra.join(" ");
        extra = await convertToHTMLFile(extra, (await LogseqProxy.Editor.getBlock(note.uuid)).format);
        assets = new Set([...assets, ...extra.assets]);
        extra = extra.html;

        return [html, assets, deck, breadcrumb, tags, extra];
    }
}
