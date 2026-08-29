import "@logseq/libs";

import type {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import {Buffer} from "buffer/";
import GITHUB_ICON from "../node_modules/@tabler/icons/icons/outline/brand-github.svg?raw";
import HEART_ICON from "../node_modules/@tabler/icons/icons/outline/heart.svg?raw";
import AI_ICON from "../node_modules/@tabler/icons/icons/outline/robot-face.svg?raw";
import pkg from "./../package.json";
import {
    initAIChat,
    initBuiltInSkillFiles,
    initContextMenu,
    OpenAIChatCommand
} from "./core/chat-interop";
import {initUserCommands} from "./core/user-commands";
import {createLogger, LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqAppInfoFetcher} from "./logseq/LogseqAppInfoFetcher";
import {LogseqAppListeners} from "./logseq/LogseqAppListeners";
import {LogseqHttpProxy} from "./logseq/LogseqHttpProxy";
import {LogseqPluginStorageManager} from "./logseq/LogseqPluginStorageManager";
import {LogseqSettingAccessor} from "./logseq/LogseqSettingAccessor";
import {WindowParentBridge} from "./logseq/WindowParentBridge";
import {registerToolbar} from "./registerToolbar";
import {addSettingsToLogseq} from "./settings";
import {showButtonModal} from "./ui";
import {UI} from "./ui/UI";

const logger = createLogger(LoggerCategory.MISC);

async function main(baseInfo: LSPluginBaseInfo) {
    // Check db version or not
    if (!(await LogseqAppInfoFetcher.checkCurrentIsDbGraph())) {
        await logseq.UI.showMsg(
            "Logseq AI Chat is only supported in DB Graphs. Please switch to DB Graphs and try again.",
            "error"
        );
        return;
    }

    LogseqHttpProxy.init();

    // Register UI and Commands
    await initAIChat();
    WindowParentBridge.setGlobalObject("LogseqAIChat", {
        showAIChat: () => new OpenAIChatCommand().execute()
    });
    registerToolbar(baseInfo);
    updateLoggerLevels();
    addSettingsToLogseq();

    // Init various modules
    await LogseqPluginStorageManager.init();
    LogseqSettingAccessor.init();
    LogseqAppListeners.init();
    UI.init();
    await initBuiltInSkillFiles();
    await initUserCommands();
    await initContextMenu();

    // The lines below are needed for vite build and dev to work properly.
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.process = process;
    // Show welcome message
    const {lastWelcomeVersion} = LogseqSettingAccessor.getPluginSettings();
    if (lastWelcomeVersion && lastWelcomeVersion !== pkg.version) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // wait logseq's react to load
        await showButtonModal(
            `<span class="flex items-center"><i class="px-1">${AI_ICON}</i>Welcome to Logseq AI Chat ${pkg.version}!</span>
            <div style="overflow-y: auto; margin-top: 10px; border: 1px solid var(--ls-border-color); border-radius: 4px;">
                <iframe src="https://github.com/debanjandhar12/logseq-ai-chat/releases/tag/v${pkg.version}" style="width: 100%; height: 100%; min-height: 400px; border: none;"></iframe>
            </div>`,
            [
                {
                    name: "Donate",
                    f: () => {
                        window.open(`https://github.com/sponsors/debanjandhar12`);
                    },
                    closeOnClick: false,
                    icon: HEART_ICON
                },
                {
                    name: "Open in GitHub",
                    f: () => {
                        window.open(
                            `https://github.com/debanjandhar12/logseq-ai-chat/releases/tag/v${pkg.version}`
                        );
                    },
                    closeOnClick: false,
                    icon: GITHUB_ICON
                }
            ],
            {enableOutsideClickClose: false}
        );
    }
    logseq.updateSettings({lastWelcomeVersion: pkg.version});
}

// Bootstrap
logseq.ready(main).catch((e) => logger.error("Failed to initialize plugin", e));
