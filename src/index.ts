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

const delay = (t = 100) => new Promise(r => setTimeout(r, t))

// --- Register UI Elements Onload ---
function main(baseInfo: LSPluginBaseInfo) {
  let syncLogseqToAnki = function() { new LogseqToAnkiSync().sync(); };
  logseq.provideModel({
    syncLogseqToAnki: syncLogseqToAnki,
  });
  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-anki-sync',
    template: `
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnki"
         class="button">
        <i class="ti ti-play-card"></i>
      </a>
    `
  });
  logseq.App.registerCommandPalette({
    key: `logseq-anki-sync-command-palette`,
    label: `Start Logseq to Anki Sync`
  }, syncLogseqToAnki);

  ClozeNote.initLogseqOperations();
  MultilineCardNote.initLogseqOperations();
}

// Bootstrap
logseq.ready(main).catch(console.error)