import "@logseq/libs";
import {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import {ClozeNote} from "./notes/ClozeNote";
import {MultilineCardNote} from "./notes/MultilineCardNote";
import {LogseqToAnkiSync} from "./syncLogseqToAnki";
import {addSettingsToLogseq} from "./settings";
import {ANKI_ICON} from "./constants";
import {LogseqProxy} from "./logseq/LogseqProxy";
import {AddonRegistry} from "./addons/AddonRegistry";
import {SwiftArrowNote} from "./notes/SwiftArrowNote";
import {ImageOcclusionNote} from "./notes/ImageOcclusionNote";
import * as blockAndPageHashCache from "./logseq/blockAndPageHashCache";
import {Buffer} from "buffer/";
import process from "process";
import {Note} from "./notes/Note";
import {showButtonModal} from "./ui/modals";
import {UI} from "./ui/UI";
import * as AnkiConnect from "./anki-connect/AnkiConnect";
import pkg from "./../package.json";

function main(baseInfo: LSPluginBaseInfo) {
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
            keybinding: {mode: "global", binding: ''}
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
        key: `logseq-anki-sync${baseInfo.id == "logseq-anki-sync" ? "" : "-" + baseInfo.id}`,
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
    };
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
    if (logseq.settings.lastWelcomeVersion &&
        logseq.settings.lastWelcomeVersion !== pkg.version) {
        (async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));    // wait logseq's react to load
            await showButtonModal(
                `<span class="flex items-center"><i class="px-1">${ANKI_ICON}</i>Welcome to Logseq Anki Sync ${pkg.version}!</span> 
                                    <br/><small class="px-2">Update is installed successfully. </small>
                                    <br /><br /><small class="px-2" style="display: block">This patch contains minor bug fixes.</small>`,
                [
                    {
                        name: "Read Release Notes",
                        f: () => {
                            window.open(
                                `https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${pkg.version}`,
                            );
                        },
                        closeOnClick: false,
                    },
                ],
            )
        })();
    }
    logseq.updateSettings({lastWelcomeVersion: pkg.version});
}

// Bootstrap
logseq.ready(main).catch(console.error);
