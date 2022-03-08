import '@logseq/libs'
import { LSPluginBaseInfo } from '@logseq/libs/dist/LSPlugin'
import * as AnkiConnect from './anki-connect/AnkiConnect';
import { LazyAnkiNoteManager } from './anki-connect/LazyAnkiNoteManager';
import { template_front, template_back, template_files } from './templates/AnkiCardTemplates';
import { Note } from './notes/Note';
import { ClozeNote } from './notes/ClozeNote';
import { MultilineCardNote } from './notes/MultilineCardNote';
import _ from 'lodash';
import { get_better_error_msg, confirm } from './utils';

const delay = (t = 100) => new Promise(r => setTimeout(r, t))

// --- Register UI Elements Onload ---
function main(baseInfo: LSPluginBaseInfo) {
  logseq.provideModel({
    syncLogseqToAnkiWrapper: syncLogseqToAnkiWrapper,
  });
  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-anki-sync',
    template: `
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnkiWrapper"
         class="button">
        <i class="ti ti-play-card"></i>
      </a>
    `
  });
  logseq.App.registerCommandPalette({
    key: `logseq-anki-sync-command-palette`,
    label: `Start Logseq to Anki Sync`
  }, syncLogseqToAnkiWrapper);

  ClozeNote.initLogseqOperations();
  MultilineCardNote.initLogseqOperations();
}

// Bootstrap
logseq.ready(main).catch(console.error)

// --- Main Functions ---
let isSyncing = false;
async function syncLogseqToAnkiWrapper() { // Wrapper function for error handling
  if (isSyncing) { console.log(`Syncing already in process...`); return; }
  isSyncing = true;
  try {
    await syncLogseqToAnki();
  } catch (e) {
    logseq.App.showMsg(get_better_error_msg(e.toString()), 'warning');
    console.error(e);
  } finally {
    isSyncing = false;
  }
}

async function syncLogseqToAnki() {
  let graphName = _.get(await logseq.App.getCurrentGraph(), 'name') || 'Default';
  let modelName = `${graphName}Model`.replace(/\s/g, "_");
  logseq.App.showMsg(`Starting Logseq to Anki Sync for graph ${graphName}`);
  console.log(`%cStarting Logseq to Anki Sync for graph ${graphName}`, 'color: green; font-size: 1.5em;');

  // -- Request Access --
  await AnkiConnect.requestPermission();

  // -- Prepare Anki Note Manager --
  let ankiNoteManager = new LazyAnkiNoteManager(modelName);
  await ankiNoteManager.init();
  Note.setAnkiNoteManager(ankiNoteManager);
  
  // -- Create models if it doesn't exists --
  await AnkiConnect.createModel(modelName, ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"], template_front, template_back, template_files);

  // -- Get the notes that are to be synced from logseq --
  let notes = [...(await ClozeNote.getNotesFromLogseqBlocks()), ...(await MultilineCardNote.getNotesFromLogseqBlocks())];
  for (let note of notes) { // Force persistance of note's logseq block uuids accross re-index by adding id property to block in logseq
    if (!note.properties["id"]) {await logseq.Editor.upsertBlockProperty(note.uuid, "id", note.uuid);}
  }
  console.log("Blocks:", notes);
  

  // -- Prompt the user what actions are going to be performed --
  let show_actions_before_sync = logseq.baseInfo.settings.show_actions_before_sync || true;
  let willCreate = 0, willUpdate, willDelete;
  if(show_actions_before_sync) {
    for(let note of notes) {let ankiId = await note.getAnkiId(); if (ankiId == null || isNaN(ankiId)) willCreate++;} 
    willUpdate = notes.length - willCreate;
    let ankiNotes = await AnkiConnect.query(`note:${modelName}`);
    willDelete = ankiNotes.length - willUpdate;
    let confirm_msg = `<b>The logseq to anki sync plugin will attempt to perform the following actions:</b><br/>Create ${willCreate} new anki notes<br/>Update ${willUpdate} existing anki notes<br/>Delete ${willDelete} anki notes<br/><br/>Are you sure you want to coninue?`;
    if(!(await confirm(confirm_msg))) {console.log("Sync Aborted by user!"); return;}
  }

  // -- Declare some variables to keep track of different operations performed --
  let start_time = performance.now();
  let failedCreated: Set<string> = new Set(), failedUpdated: Set<string> = new Set(), failedDeleted: Set<string> = new Set();

  // -- Add or update notes in anki and log respective errors --
  for (let note of notes) {
    // Prepare the content of the anki note from block
    let html;
    let deck: any = _.get(note, 'properties.deck') || _.get(note, 'page.properties.deck') || "Default";
    if (typeof deck != "string") deck = deck[0];
    let breadcrumb = `<a href="#">${note.page.originalName}</a>`;
    let tags = [...(_.get(note, 'properties.tags') || []), ...(_.get(note, 'page.properties.tags') || [])];
    let extra = _.get(note, 'properties.extra') || _.get(note, 'page.properties.extra') || "";
    if (Array.isArray(extra)) extra = extra.join(" ");
    let ankiId = await note.getAnkiId();
    if (ankiId == null || isNaN(ankiId)) {  // Perform create as note doesn't exist in anki
      try {
        console.log(`%cAdding note with uuid ${note.uuid} and type ${note.type}`, 'color: blue; background: #eee;');
        html = (await note.addClozes().convertToHtml()).getContent();
        ankiNoteManager.addNote(deck, modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
      } catch (e) { console.error(e); failedCreated.add(`${note.uuid}-${note.type}`); }
    }
    else {  // Perform update as note exists in anki
      try {
        console.log(`%cUpdating note with uuid ${note.uuid} and type ${note.type}`, 'color: blue; background: #eee;');
        html = (await note.addClozes().convertToHtml()).getContent();
        ankiNoteManager.updateNote(ankiId, deck, modelName, { "uuid-type": `${note.uuid}-${note.type}`, "uuid": note.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
      } catch (e) { console.error(e); failedUpdated.add(`${note.uuid}-${note.type}`); }
    }
  }
  let [addedNoteAnkiIdUUIDPairs, subOperationResults] = await ankiNoteManager.execute("addNotes");
  for(let addedNoteAnkiIdUUIDPair of addedNoteAnkiIdUUIDPairs) { // update ankiId of added blocks
    let uuidtype = addedNoteAnkiIdUUIDPair["uuid-type"];
    let uuid = uuidtype.split("-").slice(0, -1).join("-");
    let type = uuidtype.split("-").slice(-1)[0];
    let note = _.find(notes, { "uuid": uuid, "type": type });
    note["ankiId"] = addedNoteAnkiIdUUIDPair["ankiId"];
    console.log(note);
  }
  for(let subOperationResult of subOperationResults) {
    if(subOperationResult != null && subOperationResult.error != null) {
      console.error(subOperationResult.error);
      failedCreated.add(subOperationResult["uuid-type"]); 
    }
  }
  for(let subOperationResult of await ankiNoteManager.execute("updateNotes")) {
    if(subOperationResult != null && subOperationResult.error != null) {
      console.error(subOperationResult.error);
      failedUpdated.add(subOperationResult.error.uuid); 
    }
  }


  // -- Delete the notes in anki whose respective blocks is no longer available in logseq --
  let ankiNoteIds: number[] = (await AnkiConnect.query(`note:${modelName}`)).map(i => parseInt(i)); // Get anki notes made from this logseq graph
  let blockAnkiIds: number[] = await Promise.all(notes.map(async block => await block.getAnkiId())); // Flatten current logseq block's anki ids
  // Delete anki notes created by app which are no longer in logseq graph
  for (let ankiNoteId of ankiNoteIds) {
    if (!blockAnkiIds.includes(ankiNoteId)) {
        console.log(`Deleting note with ankiId ${ankiNoteId}`);
        ankiNoteManager.deleteNote(ankiNoteId);
    }
  }
  for(let result of await ankiNoteManager.execute("deleteNotes")) {
    if(result != null && result.error != null) {
      console.error(result.error);
      failedDeleted.add(result.error.ankiId); 
    }
  }

  // -- Update anki and show result summery in logseq --
  await AnkiConnect.invoke("reloadCollection", {});
  let summery = `Sync Completed! Created Blocks: ${willCreate-failedCreated.size} Updated Blocks: ${willUpdate-failedUpdated.size} Deleted Blocks: ${willDelete-failedDeleted.size} `;
  let status = 'success';
  if (failedCreated.size > 0) summery += `Failed Created: ${failedCreated.size} `;
  if (failedUpdated.size > 0) summery += `Failed Updated: ${failedUpdated.size} `;
  if (failedDeleted.size > 0) summery += `Failed Deleted: ${failedDeleted.size} `;
  if (failedCreated.size > 0 || failedUpdated.size > 0 || failedDeleted.size > 0) status = 'warning';
  logseq.App.showMsg(summery, status);
  console.log(summery);
  if (failedCreated.size > 0) console.log("Failed Created:", failedCreated);
  if (failedUpdated.size > 0) console.log("Failed Updated:", failedUpdated);
  if (failedDeleted.size > 0) console.log("Failed Deleted:", failedDeleted);
  console.log("syncLogseqToAnki() Time Taken:", (performance.now() - start_time).toFixed(2), "ms");
}