import '@logseq/libs'
import { LSPluginBaseInfo } from '@logseq/libs/dist/LSPlugin'
import { ClozeNote } from './notes/ClozeNote';
import { MultilineCardNote } from './notes/MultilineCardNote';
import _ from 'lodash';
import { LogseqToAnkiSync } from './syncLogseqToAnki';
import { addSettingsToLogseq } from './settings';
import { ANKI_ICON } from './constants';
import { LogseqProxy } from './logseq/LogseqProxy';
import { AddonRegistry } from './addons/AddonRegistry';
import { SwiftArrowNote } from './notes/SwiftArrowNote';
import {ImageOcclusionNote} from "./notes/ImageOcclusionNote";
import * as blockAndPageHashCache from './logseq/blockAndPageHashCache';

// --- Register UI Elements Onload ---
async function main(baseInfo: LSPluginBaseInfo) {
  let syncLogseqToAnki = async function() { new LogseqToAnkiSync().sync();  };
  logseq.provideModel({
    syncLogseqToAnki: syncLogseqToAnki,
  });
  logseq.App.registerCommandPalette({
    key: `logseq-anki-sync-command-palette-${baseInfo.id}`,
    label: `Start Logseq to Anki Sync`
  }, syncLogseqToAnki);
  logseq.provideStyle(`
    .logseq-anki-toolbar-item-${baseInfo.id} {
      display: flex;
      align-items: center;
      position: relative;
      top: 0px;
      opacity: 0.8;
    }
    .logseq-anki-toolbar-item-${baseInfo.id}:hover {
      opacity: 1;
    }
  `);
  logseq.App.registerUIItem('toolbar', {
    key: `logseq-anki-sync${baseInfo.id == "logseq-anki-sync"? "" : "-"+baseInfo.id}`,
    template: String.raw`
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnki" class="button logseq-anki-toolbar-item-${baseInfo.id}">
        <i class="ti">${ANKI_ICON}</i>
      </a>
    `
  });

  addSettingsToLogseq();
  LogseqProxy.init();
  blockAndPageHashCache.init();
  AddonRegistry.getAll().forEach(addon => addon.init());
  ClozeNote.initLogseqOperations();
  MultilineCardNote.initLogseqOperations();
  SwiftArrowNote.initLogseqOperations();
  ImageOcclusionNote.initLogseqOperations();
  console.log("Window Parent:", window.parent);
}

// Bootstrap
logseq.ready(main).catch(console.error)