import "@logseq/libs";
import { LSPluginBaseInfo } from "@logseq/libs/dist/LSPlugin";
import { ClozeNote } from "./notes/ClozeNote";
import { MultilineCardNote } from "./notes/MultilineCardNote";
import _ from "lodash";
import { LogseqToAnkiSync } from "./syncLogseqToAnki";
import { addSettingsToLogseq } from "./settings";
import { ANKI_ICON } from "./constants";
import { LogseqProxy } from "./logseq/LogseqProxy";
import { AddonRegistry } from "./addons/AddonRegistry";
import { SwiftArrowNote } from "./notes/SwiftArrowNote";
import { ImageOcclusionNote } from "./notes/ImageOcclusionNote";
import * as blockAndPageHashCache from "./logseq/blockAndPageHashCache";
import { Buffer } from "buffer/";
import process from "process";
import {SelectionModal} from "./ui/SelectionModal";
import {Note} from "./notes/Note";
import {showModelWithButtons} from "./ui/ModelWithBtns";
import {UI} from "./ui/UI";

async function main(baseInfo: LSPluginBaseInfo) {
    // Register UI and Commands
    const syncLogseqToAnki = async function () {
        await new LogseqToAnkiSync().sync();
    };
    logseq.provideModel({
        syncLogseqToAnki: syncLogseqToAnki,
    });
    logseq.App.registerCommandPalette(
        {
            key: `logseq-anki-sync-command-palette-${baseInfo.id}`,
            label: `Start Logseq to Anki Sync`,
        },
        syncLogseqToAnki,
    );
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
    logseq.App.registerUIItem("toolbar", {
        key: `logseq-anki-sync${
            baseInfo.id == "logseq-anki-sync" ? "" : "-" + baseInfo.id
        }`,
        template: String.raw`
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnki" class="button logseq-anki-toolbar-item-${baseInfo.id}">
        <i class="ti">${ANKI_ICON}</i>
      </a>
    `,
    });
    addSettingsToLogseq();

    // Init various modules
    window.parent.LogseqAnkiSync = {};
    window.parent.LogseqAnkiSync.dispatchEvent = (event: string) => {
        window.dispatchEvent(new Event(event));
    }
    LogseqProxy.init();
    blockAndPageHashCache.init();
    Note.initLogseqOperations();
    ClozeNote.initLogseqOperations();
    MultilineCardNote.initLogseqOperations();
    SwiftArrowNote.initLogseqOperations();
    ImageOcclusionNote.initLogseqOperations();
    AddonRegistry.getAll().forEach((addon) => addon.init());
    UI.init();
    console.log("Window Parent:", window.parent);

    // The lines below are needed for vite build and dev to work properly.
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.process = process;

    // Show welcome message
    if (logseq.settings.lastWelcomeVersion && logseq.settings.lastWelcomeVersion !== baseInfo.version) {
        showModelWithButtons(`Welcome to Logseq Anki Sync ${baseInfo.version}! <br/><br/><small>Update is installed successfully.</small>`,
            [{name:"Read Release notes", f:()=>{
                    window.open(`https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${baseInfo.version}`);
                }}]);
    }
    logseq.updateSettings({lastWelcomeVersion: baseInfo.version});
}

// Bootstrap
logseq.ready(main).catch(console.error);
