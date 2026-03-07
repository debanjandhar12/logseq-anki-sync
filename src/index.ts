import "@logseq/libs";
import { LSPluginBaseInfo } from "@logseq/libs/dist/LSPlugin";
import { ClozeNote } from "./anki-notes/ClozeNote";
import { MultilineCardNote } from "./anki-notes/MultilineCardNote";
import { LogseqToAnkiSync } from "./sync/syncLogseqToAnki";
import { addSettingsToLogseq } from "./settings";
import { ANKI_ICON } from "./constants";
import GITHUB_ICON from "../node_modules/@tabler/icons/icons/outline/brand-github.svg?raw";
import HEART_ICON from "../node_modules/@tabler/icons/icons/outline/heart.svg?raw";
import { LogseqProxy } from "./logseq/LogseqProxy";
import { AddonRegistry } from "./addons/AddonRegistry";
import { SwiftArrowNote } from "./anki-notes/SwiftArrowNote";
import { ImageOcclusionNote } from "./anki-notes/ImageOcclusionNote";
import { HighlightMaskNote } from "./anki-notes/HighlightMaskNote";
import { BlockAndPageHashCache } from "./sync/cache";
import { Buffer } from "buffer/";
import { Note } from "./anki-notes/Note";
import { showButtonModal } from "./ui";
import { UI } from "./ui/UI";
import * as AnkiConnect from "./anki-connect/AnkiConnect";
import pkg from "./../package.json";
import { WindowParentBridge } from "./logseq/WindowParentBridge";

import { registerToolbar } from "./registerToolbar";
import { createLogger, LoggerCategory, updateLoggerLevels } from "./utils/logger";

const logger = createLogger(LoggerCategory.Others);

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
            keybinding: { mode: "global", binding: "" },
        },
        syncLogseqToAnki,
    );
    registerToolbar(baseInfo);
    updateLoggerLevels();
    addSettingsToLogseq();

    // Init various modules
    WindowParentBridge.setGlobalObject("LogseqAnkiSync", {
        dispatchEvent: (event: string) => {
            WindowParentBridge.dispatchEvent(event);
        },
    });
    LogseqProxy.init();
    BlockAndPageHashCache.init();
    Note.initLogseqOperations();
    ClozeNote.initLogseqOperations();
    MultilineCardNote.initLogseqOperations();
    SwiftArrowNote.initLogseqOperations();
    ImageOcclusionNote.initLogseqOperations();
    HighlightMaskNote.initLogseqOperations();
    AddonRegistry.getAll().forEach((addon) => addon.init());
    UI.init();
    WindowParentBridge.setGlobalObject("AnkiConnect", AnkiConnect); // Make AnkiConnect available globally

    // The lines below are needed for vite build and dev to work properly.
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.process = process;

    // Show welcome message
    const { lastWelcomeVersion } = LogseqProxy.Settings.getPluginSettings();
    console.log("lastWelcomeVersion", lastWelcomeVersion, pkg.version);
    if (lastWelcomeVersion && lastWelcomeVersion !== pkg.version) {
        logseq.updateSettings({ lastWelcomeVersion: pkg.version });
        await new Promise((resolve) => setTimeout(resolve, 1000)); // wait logseq's react to load
        await showButtonModal(
            `<span class="flex items-center"><i class="px-1">${ANKI_ICON}</i>Welcome to Logseq Anki Sync ${pkg.version}!</span>
            <div style="overflow-y: auto; margin-top: 10px; border: 1px solid var(--ls-border-color); border-radius: 4px;">
                <iframe src="https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${pkg.version}" style="width: 100%; height: 100%; min-height: 400px; border: none;"></iframe>
            </div>`,
            [
                {
                    name: "Donate",
                    f: () => {
                        window.open(`https://github.com/sponsors/debanjandhar12`);
                    },
                    closeOnClick: false,
                    icon: HEART_ICON,
                },
                {
                    name: "Open in GitHub",
                    f: () => {
                        window.open(
                            `https://github.com/debanjandhar12/logseq-anki-sync/releases/tag/v${pkg.version}`,
                        );
                    },
                    closeOnClick: false,
                    icon: GITHUB_ICON,
                },
            ],
            { enableOutsideClickClose: false },
        );
    }
}

// Bootstrap
logseq.ready(main).catch((e) => logger.error("Failed to initialize plugin", e));
