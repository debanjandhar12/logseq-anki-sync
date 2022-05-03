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
import { LogseqToAnkiSync } from './syncLogseqToAnki';
import { previewBlockNotesInAnki } from './previewBlockNotesInAnki';
import { addSettingsToLogseq } from './settings';
import { ANKI_ICON } from './constants';


// --- Register UI Elements Onload ---
async function main(baseInfo: LSPluginBaseInfo) {
  let syncLogseqToAnki = async function() { new LogseqToAnkiSync().sync();  };
  logseq.provideModel({
    syncLogseqToAnki: syncLogseqToAnki,
  });
  logseq.App.registerCommandPalette({
    key: `logseq-anki-sync-command-palette`,
    label: `Start Logseq to Anki Sync`
  }, syncLogseqToAnki);
  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-anki-sync',
    template: String.raw`
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnki" class="button">
        <i class="ti">${ANKI_ICON}</i>
      </a>
    `
  });

  if(logseq.settings.previewNotesInAnki)
    logseq.Editor.registerBlockContextMenuItem("Preview notes from block in Anki", previewBlockNotesInAnki);

  ClozeNote.initLogseqOperations();
  MultilineCardNote.initLogseqOperations();

  addSettingsToLogseq();
}

// Bootstrap
logseq.ready(main).catch(console.error)