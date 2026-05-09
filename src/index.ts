import "@logseq/libs";
import type {LSPluginBaseInfo} from "@logseq/libs/dist/LSPlugin";
import {Buffer} from "buffer/";
import GITHUB_ICON from "../node_modules/@tabler/icons/icons/outline/brand-github.svg?raw";
import HEART_ICON from "../node_modules/@tabler/icons/icons/outline/heart.svg?raw";
import AI_ICON from "../node_modules/@tabler/icons/icons/outline/robot-face.svg?raw";
import pkg from "./../package.json";
import {initAIChat, showAIChat} from "./chat/AIChatController";
import {createLogger, LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqAppListeners} from "./logseq/LogseqAppListeners";
import {LogseqSettingAccessor} from "./logseq/LogseqSettingAccessor";
import {WindowParentBridge} from "./logseq/WindowParentBridge";
import {registerToolbar} from "./registerToolbar";
import {addSettingsToLogseq} from "./settings";
import {showButtonModal} from "./ui";
import {UI} from "./ui/UI";

const logger = createLogger(LoggerCategory.MISC);

async function main(baseInfo: LSPluginBaseInfo) {
    // Register UI and Commands
    await initAIChat();
    logseq.provideModel({showAIChat: showAIChat});
    logseq.App.registerCommandPalette(
        {
            key: `logseq-ai-chat-command-palette-${baseInfo.id}`,
            label: `Open Logseq AI Chat`,
            keybinding: {mode: "global", binding: ""}
        },
        showAIChat
    );
    WindowParentBridge.setGlobalObject("LogseqAIChat", {
        showAIChat: showAIChat
    });
    registerToolbar(baseInfo);
    updateLoggerLevels();
    addSettingsToLogseq();

    // Init various modules
    LogseqSettingAccessor.init();
    LogseqAppListeners.init();
    UI.init();

    // The lines below are needed for vite build and dev to work properly.
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.process = process;

    // Show welcome message
    const {lastWelcomeVersion} = LogseqSettingAccessor.getPluginSettings();
    if (lastWelcomeVersion && lastWelcomeVersion !== pkg.version) {
        logseq.updateSettings({lastWelcomeVersion: pkg.version});
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
}

// Bootstrap
logseq.ready(main).catch((e) => logger.error("Failed to initialize plugin", e));
