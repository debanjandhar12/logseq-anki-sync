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
import * as AnkiConnect from "./anki-connect/AnkiConnect";

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
    logseq-anki-toolbar-item-${baseInfo.id} {
      display: flex;
      align-items: center;
      position: relative;
      top: 0px;
      opacity: 0.8;
    }
    logseq-anki-toolbar-item-${baseInfo.id}:hover {
      opacity: 1;
    }
  `);
    logseq.App.registerUIItem("toolbar", {
        key: `logseq-anki-sync${
            baseInfo.id == "logseq-anki-sync" ? "" : "-" + baseInfo.id
        }`,
        template: String.raw`
      <a title="Start Logseq to Anki Sync" data-on-click="syncLogseqToAnki" class="button logseq-anki-toolbar-item-${baseInfo.id}">
        <i class="ui__icon ti" style="font-size: 18px;">${ANKI_ICON}</i>
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
    window.parent.AnkiConnect = AnkiConnect; // Make AnkiConnect available globally
    console.log("Window Parent:", window.parent);

    // The lines below are needed for vite build and dev to work properly.
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.process = process;

    // Show welcome message
    if (logseq.settings.lastWelcomeVersion && logseq.settings.lastWelcomeVersion !== baseInfo.version) {
        showModelWithButtons(`<span class="flex items-center"><i class="px-1">${ANKI_ICON}</i>Welcome to Logseq Anki Sync ${baseInfo.version}!</span> 
                                    <br/><small class="px-2">Update is installed successfully.</small>
                                    <br/><br/><hr/><div class="flex flex-row admonitionblock align-items tip"><div title="Tip" class="pr-4 admonition-icon flex flex-col justify-center"><svg viewBox="0 0 352 512" fill="currentColor" class="h-8 w-8 tip"><path d="M96.06 454.35c.01 6.29 1.87 12.45 5.36 17.69l17.09 25.69a31.99 31.99 0 0 0 26.64 14.28h61.71a31.99 31.99 0 0 0 26.64-14.28l17.09-25.69a31.989 31.989 0 0 0 5.36-17.69l.04-38.35H96.01l.05 38.35zM0 176c0 44.37 16.45 84.85 43.56 115.78 16.52 18.85 42.36 58.23 52.21 91.45.04.26.07.52.11.78h160.24c.04-.26.07-.51.11-.78 9.85-33.22 35.69-72.6 52.21-91.45C335.55 260.85 352 220.37 352 176 352 78.61 272.91-.3 175.45 0 73.44.31 0 82.97 0 176zm176-80c-44.11 0-80 35.89-80 80 0 8.84-7.16 16-16 16s-16-7.16-16-16c0-61.76 50.24-112 112-112 8.84 0 16 7.16 16 16s-7.16 16-16 16z"></path></svg></div><div class="ml-4 text-sm"><p>
                                    Vote Features for next version: <a href="https://forms.gle/jmDBUhcK9zMjGUk97">https://forms.gle/jmDBUhcK9zMjGUk97</a></a> </p></div></div>`,
            [{name:"Read Release notes", f:()=>{
                    window.open(`https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${baseInfo.version}`);
                }, returnOnClick: false},
            ]);
    }
    logseq.updateSettings({lastWelcomeVersion: baseInfo.version});
}

// Bootstrap
logseq.ready(main).catch(console.error);
