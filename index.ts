import '@logseq/libs'
import { LSPluginBaseInfo } from '@logseq/libs/dist/libs'
import * as AnkiConnect from './AnkiConnect';
import * as AnkiConnectExtended from './AnkiConnectExtended';
import { AnkiCardTemplates } from './templates/AnkiCardTemplates';
import { Remarkable } from 'remarkable';
import path from "path";

const delay = (t = 100) => new Promise(r => setTimeout(r, t))

// --- Register UI Elements Onload ---
function main(baseInfo: LSPluginBaseInfo) {
  let syncing = false;

  logseq.provideModel({
    async syncObsidianToAnkiWrapper() { // Wrapper function for error handling
      if (syncing) { console.log(`Syncing already in process...`); return; }
      syncing = true;

      try {
        await syncObsidianToAnki();
      } catch (e) {
        logseq.App.showMsg(e.toString(), 'warning')
        console.error(e);
      } finally {
        syncing = false;
      }
    }
  })

  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-anki',
    template: `
      <a data-on-click="syncObsidianToAnkiWrapper"
         class="button">
        <i class="ti ti-play-card"></i>
      </a>
    `
  })
}

// Bootstrap
logseq.ready(main).catch(console.error)

// --- Main Functions ---
async function syncObsidianToAnki() {
  let backup = logseq.baseInfo.settings.backup || false;
  let graphName = (await logseq.App.getCurrentGraph()).name;
  logseq.App.showMsg(`Starting Logseq to Anki Sync for graph ${graphName}`);
  console.log(`Starting Logseq to Anki Sync for graph ${graphName}`);

  // -Request Access-
  await AnkiConnect.requestPermission();

  // -- Create backup of Anki --
  try { if (backup) await AnkiConnect.createBackup(); } catch (e) { console.error(e); }

  // -Create models if it doesn't exists-
  await AnkiConnect.createModel(`${graphName}Model`, ["uuid", "Text", "Extra", "Breadcrumb", "Config", "Tobedefinedlater", "Tobedefinedlater2"], AnkiCardTemplates.frontTemplate, AnkiCardTemplates.backTemplate);

  // -- Find blocks for which anki notes are to be created --
  let blocks = await logseq.DB.datascriptQuery(`
  [:find (pull ?b  [*])
  :where
    [?b :block/properties ?p]
    [(get ?p :ankicloze) ?t]
  ]`);
  blocks = await Promise.all(blocks.map(async (block) => {
    return { ...(await logseq.Editor.getBlock(block[0].uuid.Wd)), ankiId: await AnkiConnectExtended.getAnkiIDForModelFromUUID(block[0].uuid.Wd, `${graphName}Model`), page: await logseq.Editor.getPage(block[0].page.id) };
  }));
  console.log("Blocks:", blocks);

  // -- Declare some variables to keep track of different operations performed --
  let created, updated, deleted, failedCreated, failedUpdated, failedDeleted: number;
  created = updated = deleted = failedCreated = failedUpdated = failedDeleted = 0;

  // --Add or update cards in anki--
  for (let block of blocks) {
    if (block.ankiId == null || isNaN(block.ankiId)) {
      try {
        let anki_html = await addClozesToMdAndConvertToHtml(block.content, `[${block.properties.ankicloze}]`);
        let deck: any = (block.page.hasOwnProperty("properties") && block.page.properties.hasOwnProperty("deck")) ? block.page.properties.deck : "Default";
        let breadcrumb_html = `<a href="#">${block.page.originalName}</a>`;
        let tags = (block.page.hasOwnProperty("properties") && block.page.properties.hasOwnProperty("tags")) ? block.page.properties.tags : [];
        block.ankiId = await AnkiConnect.addNote(block.uuid, deck, `${graphName}Model`, { "uuid": block.uuid, "Text": anki_html, "Extra": "", "Breadcrumb": breadcrumb_html }, tags);
        console.log(`Added note with uuid ${block.uuid}`);
        created++;
      } catch (e) { console.error(e); failedCreated++; }
    }
    else {
      try {
        let anki_html = await addClozesToMdAndConvertToHtml(block.content, `[${block.properties.ankicloze}]`);
        let deck: any = (block.page.hasOwnProperty("properties") && block.page.properties.hasOwnProperty("deck")) ? block.page.properties.deck : "Default";
        let breadcrumb_html = `<a href="#">${block.page.originalName}</a>`;
        let tags = (block.page.hasOwnProperty("properties") && block.page.properties.hasOwnProperty("tags")) ? block.page.properties.tags : [];
        await AnkiConnect.updateNote(block.ankiId, deck, `${graphName}Model`, { "uuid": block.uuid, "Text": anki_html, "Extra": "", "Breadcrumb": breadcrumb_html }, tags);
        console.log(`Updated note with uuid ${block.uuid}`);
        updated++;
      } catch (e) { console.error(e); failedUpdated++; }
    }
  }

  // --Delete the deleted cards--
  await AnkiConnect.invoke("reloadCollection", {});
  // Get Anki Notes made from this logseq graph
  let q = await AnkiConnect.query(`note:${graphName}Model`)
  let ankiNoteIds: number[] = q.map(i => parseInt(i));
  console.log(ankiNoteIds);
  // Flatten curren logseq block's anki ids
  let blockAnkiIds: number[] = blocks.map(block => parseInt(block.ankiId));
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

  // --Update Anki and show summery in logseq--
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
}

async function addClozesToMdAndConvertToHtml(text: string, regexArr: any): Promise<string> {
  let res = text;

  regexArr = eval(regexArr)
  console.log(regexArr);
  for (let [i, reg] of regexArr.entries()) {
    res = res.replace(reg, (match) => {
      return `{{c${i + 1}::${match} }}`
    });
  }
  res = res.replace(/^(\w|-)*::.*/gm, "");  //Remove properties
  res = res.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g, "\\\\( $1 \\\\)"); // Convert inline math
  res = res.replace(/\$\$([\s\S]*?)\$\$/g, "\\\\[ $1 \\\\]"); // Convert block math

  let remarkable = new Remarkable('full', {
    html: true,
    breaks: true,
    typographer: false,
  });
  remarkable.inline.ruler.disable(['sub', 'sup', 'ins']);
  remarkable.block.ruler.disable(['code']);
  const originalLinkValidator = remarkable.inline.validateLink;
  const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
  const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
  const isWebURL = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
  remarkable.inline.validateLink = (url: string) => originalLinkValidator(url) || encodeURI(url).match(dataLinkRegex)|| (encodeURI(url).match(isImage) && !encodeURI(url).match(isWebURL));
  const originalImageRender = remarkable.renderer.rules.image;
  let graphPath = (await logseq.App.getCurrentGraph()).path;
  remarkable.renderer.rules.image = (...a) => {
      if((encodeURI(a[0][a[1]].src).match(isImage) && !encodeURI(a[0][a[1]].src).match(isWebURL))) { // Image is relative to vault
          let imgPath = path.join(path.join(graphPath,"/assets/", a[0][a[1]].src));
          AnkiConnect.storeMediaFileByPath(encodeURIComponent(a[0][a[1]].src), imgPath); // Flatten and save
          a[0][a[1]].src = encodeURIComponent(a[0][a[1]].src); // Flatten image and convert to markdown.
      }
      return originalImageRender(...a);   
  };
  res = remarkable.render(res);
  console.log(res);

  return res;
}