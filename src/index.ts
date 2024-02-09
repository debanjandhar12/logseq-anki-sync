import "@logseq/libs";
import {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import {ClozeNote} from "./notes/ClozeNote";
import {MultilineCardNote} from "./notes/MultilineCardNote";
import _ from "lodash";
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
import {SelectionModal} from "./ui/general/SelectionModal";
import {Note} from "./notes/Note";
import {showModelWithButtons} from "./ui/general/ModelWithBtns";
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
    if (
        logseq.settings.lastWelcomeVersion &&
        logseq.settings.lastWelcomeVersion !== baseInfo.version
    ) {
        showModelWithButtons(
            `<span class="flex items-center"><i class="px-1">${ANKI_ICON}</i>Welcome to Logseq Anki Sync ${baseInfo.version}!</span> 
                                    <br/><small class="px-2">Update is installed successfully. </small>
                                    <br /><br /><small class="px-2">In this version, automated testing was added to prevent regression, and several bugs were squashed.</small>
                                    <br/><br/><div class="flex flex-row align-items"><div title="Warning" class="pr-4 admonition-icon flex flex-col justify-center"><svg viewBox="0 0 576 512" fill="var(--ls-warning-color)" class="h-8 w-8 warning"><path d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"></path></svg></div><div class="ml-4">
                                    <small>This plugin is now incompatible with Logseq versions earlier than <b style="color: var(--ls-wb-background-color-red)">0.10.5</b>. Sadly this had to be done as supporting older versions was consuming significant development time.</small></div></div></div></div>
                                    `,
            [
                {
                    name: "Read Release notes",
                    f: () => {
                        window.open(
                            `https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${pkg.version}`,
                        );
                    },
                    returnOnClick: false,
                },
            ],
        );
    }
    logseq.updateSettings({lastWelcomeVersion: baseInfo.version});
}

// Bootstrap
logseq.ready(main).catch(console.error);
