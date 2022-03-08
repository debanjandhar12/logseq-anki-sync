import '@logseq/libs'
import { LSPluginBaseInfo } from '@logseq/libs/dist/LSPlugin'
import * as AnkiConnect from './AnkiConnect';
import { template_front, template_back, template_files } from './templates/AnkiCardTemplates';
import { Block } from './Block';
import { ClozeBlock } from './ClozeBlock';
import { MultilineCardBlock } from './MultilineCardBlock';
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

  ClozeBlock.initLogseqOperations();
  MultilineCardBlock.initLogseqOperations();
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

  // -- Create models if it doesn't exists --
  await AnkiConnect.createModel(modelName, ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"], template_front, template_back, template_files);

  // -- Find blocks for which anki notes are to be created --
  let blocks = [...(await ClozeBlock.getBlocksFromLogseq()), ...(await MultilineCardBlock.getBlocksFromLogseq())];
  for (let block of blocks) { // Force persistance of block uuids accross re-index by adding id property to block in logseq
    if (!block.properties["id"]) {await logseq.Editor.upsertBlockProperty(block.uuid, "id", block.uuid);}
  }
  console.log("Blocks:", blocks);

  // -- Prompt the user what actions are going to be performed --
  let show_actions_before_sync = logseq.baseInfo.settings.show_actions_before_sync || true;
  if(show_actions_before_sync) {
    let willCreate = 0, willUpdate, willDelete;
    for(let block of blocks) {let ankiId = await block.getAnkiId(); if (ankiId == null || isNaN(ankiId)) willCreate++;} 
    willUpdate = blocks.length - willCreate;
    let ankiNotes = await AnkiConnect.query(`note:${modelName}`);
    willDelete = ankiNotes.length - willUpdate;
    let confirm_msg = `<b>The logseq to anki sync plugin will attempt to perform the following actions:</b><br/>Create ${willCreate} new anki notes<br/>Update ${willUpdate} existing anki notes<br/>Delete ${willDelete} anki notes<br/><br/>Are you sure you want to coninue?`;
    if(!(await confirm(confirm_msg))) {console.log("Sync Aborted by user!"); return;}
  }

  // -- Declare some variables to keep track of different operations performed --
  let start_time = performance.now();
  let created, updated, deleted, failedCreated, failedUpdated, failedDeleted: number;
  created = updated = deleted = failedCreated = failedUpdated = failedDeleted = 0;
  let failedCreatedArr: Array<Block> = [], failedUpdatedArr: Array<Block> = [];
  // failedCreatedArr = []; failedUpdatedArr = [];

  // -- Add or update notes in anki --
  for (let block of blocks) {
    // Prepare the content of the anki note from block
    let html;
    let deck: any = _.get(block, 'properties.deck') || _.get(block, 'page.properties.deck') || "Default";
    if (typeof deck != "string") deck = deck[0];
    let breadcrumb = `<a href="#">${block.page.originalName}</a>`;
    let tags = [...(_.get(block, 'properties.tags') || []), ...(_.get(block, 'page.properties.tags') || [])];
    let extra = _.get(block, 'properties.extra') || _.get(block, 'page.properties.extra') || "";
    if (Array.isArray(extra)) extra = extra.join(" ");
    let ankiId = await block.getAnkiId();
    if (ankiId == null || isNaN(ankiId)) {  // Perform create as note doesn't exist in anki
      try {
        console.log(`%cAdding note with uuid ${block.uuid} and type ${block.type}`, 'color: blue; background: #eee;');
        html = (await block.addClozes().convertToHtml()).getContent();
        ankiId = await AnkiConnect.addNote(deck, modelName, { "uuid-type": `${block.uuid}-${block.type}`, "uuid": block.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
        created++;
      } catch (e) { console.error(e); failedCreated++; failedCreatedArr.push(block); }
    }
    else {  // Perform update as note exists in anki
      try {
        console.log(`%cUpdating note with uuid ${block.uuid} and type ${block.type}`, 'color: blue; background: #eee;');
        html = (await block.addClozes().convertToHtml()).getContent();
        await AnkiConnect.updateNote(ankiId, deck, modelName, { "uuid-type": `${block.uuid}-${block.type}`, "uuid": block.uuid, "Text": html, "Extra": extra, "Breadcrumb": breadcrumb }, tags);
        updated++;
      } catch (e) { console.error(e); failedUpdated++; failedUpdatedArr.push(block); }
    }
  }

  // -- Delete the notes in anki whose respective blocks is no longer available in logseq --
  // Get anki notes made from this logseq graph
  let ankiNoteIds: number[] = (await AnkiConnect.query(`note:${modelName}`)).map(i => parseInt(i));
  console.log(ankiNoteIds);
  // Flatten current logseq block's anki ids
  let blockAnkiIds: number[] = await Promise.all(blocks.map(async block => await block.getAnkiId()));
  console.log(blockAnkiIds);
  // Delete anki notes created by app which are no longer in logseq graph
  for (let ankiNoteId of ankiNoteIds) {
    if (!blockAnkiIds.includes(ankiNoteId)) {
      try {
        await AnkiConnect.deteteNote(ankiNoteId);
        console.log(`Deleted note with ankiId ${ankiNoteId}`);
        deleted++;
      } catch (e) { console.error(e); failedDeleted++; }
    }
  }

  // -- Update anki and show result summery in logseq --
  await AnkiConnect.invoke("removeEmptyNotes", {});
  await AnkiConnect.invoke("reloadCollection", {});
  let summery = `Sync Completed! Created Blocks: ${created} Updated Blocks: ${updated} Deleted Blocks: ${deleted} `;
  let status = 'success';
  if (failedCreated > 0) summery += `Failed Created Blocks: ${failedCreated} `;
  if (failedUpdated > 0) summery += `Failed Updated Blocks: ${failedUpdated} `;
  if (failedDeleted > 0) summery += `Failed Deleted Blocks: ${failedDeleted} `;
  if (failedCreated > 0 || failedUpdated > 0 || failedDeleted > 0) status = 'warning';
  logseq.App.showMsg(summery, status);
  console.log(summery);
  if (failedCreated > 0) console.log("failedCreatedArr:", failedCreatedArr);
  if (failedUpdated > 0) console.log("failedUpdatedArr:", failedUpdatedArr);
  console.log("syncLogseqToAnki() Time Taken:", (performance.now() - start_time).toFixed(2), "ms");
}