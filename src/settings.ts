import {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import { WindowParentBridge } from "./logseq/WindowParentBridge";
import {AddonRegistry} from "./addons/AddonRegistry";
import {LogseqProxy} from "./logseq/LogseqProxy";
import {DONATE_ICON} from "./constants";

// Type definitions for plugin settings
export interface PluginSettings {
    disabled: boolean;
    breadcrumbDisplay?: "Dont show breadcrumb" | "Show Page name only" | "Show Page name and parent blocks context";
    includeParentContent?: boolean;
    renderClozeMarcosInLogseq?: boolean;
    hideClozeMarcosUntilHoverInLogseq?: boolean;
    addonsList?: string[];
    ankiFieldOptions?: ("furigana" | "kana" | "kanji" | "tts" | "tags" | "rtl")[];
    syncOverwriteList?: string[];
    debug?: ("syncLogseqToAnki.ts" | "LogseqProxy.ts" | "LogseqToHtmlConverter.ts" | "LazyAnkiNoteManager.ts" | "blockAndPageHashCache.ts")[];
    skipOnDependencyHashMatch?: boolean;
    lastWelcomeVersion?: string;
}

export const addSettingsToLogseq = () => {
    const settingsTemplate: SettingSchemaDesc[] = [
        {
            key: "donationHeading",
            title: "",
            description: `<a href="https://github.com/sponsors/debanjandhar12"><img alt="Donate" style="margin-top:-20px; height: 28px;" src="${DONATE_ICON}" /></a>`,
            type: "heading",
            default: null,
        },
        {
            key: "ankiDisplaySettingsHeading",
            title: "📇 Anki Display & Deck",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "breadcrumbDisplay",
            type: "enum",
            default: "Show Page name only",
            title: "What to display in the breadcrumb? (Recommended: Show Page name only)",
            description: "Choose what to display in the Anki card breadcrumb.",
            enumChoices: [
                "Dont show breadcrumb",
                "Show Page name only",
                "Show Page name and parent blocks context",
            ],
            enumPicker: "select",
        },
        {
            key: "includeParentContent",
            type: "boolean",
            default: true,
            title: "Include parent content in cards? (Recommended: Enabled)",
            description: "When enabled, the parent blocks content will be shown in the card.",
        },
        {
            key: "logseqSideSettingsHeading",
            title: "🐾 Logseq Menu & Display",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "renderClozeMarcosInLogseq",
            type: "boolean",
            default: false,
            title: "Render cloze macros in Logseq? (Recommended: Disabled) [Experimental] [In Development]",
            description:
                "When enabled, markdown used inside ({{c1 Hello}}, {{c2 World}}, ...) clozes will be rendered.",
        },
        {
            key: "hideClozeMarcosUntilHoverInLogseq",
            type: "boolean",
            default: false,
            title: "Hide cloze macros in Logseq? (Recommended: Disabled) [Experimental]",
            description:
                "When enabled, ({{c1 Hello}}, {{c2 World}}, ...) clozes will be hidden by default and displayed only on hover.",
        },
        {
            key: "addonsList",
            type: "enum",
            default: AddonRegistry.getAll().map((addon) => addon.getName()),
            title: "Addons:",
            enumChoices: AddonRegistry.getAll().map((addon) => addon.getName()),
            enumPicker: "checkbox",
            description:
                "Select the addons to use. They add / modify gui elements to enhance plugin capabilities inside Logseq."
        },
        {
            key: "advancedSettingsHeading",
            title: "🎓 Advanced Settings",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "syncOverwriteList",
            type: "enum",
            default: ["Content", "Deck", "Tags", "Suspended"],
            title: "Overwrite following on every sync: (Recommended: All)",
            description: "This option allows you to set what will be overwritten when sync is performed for a card.",
            enumChoices: [
                "Content",
                "Deck",
                "Tags",
                "Suspended"
            ],
            enumPicker: "checkbox",
        },
        {
            key: "ankiFieldOptions",
            type: "enum",
            default: [],
            title: "Select different field options to apply to Anki cards? (Recommended: None)",
            description: "This option allows you to add different filters and additional stuff to the Anki card templates. " +
                "Takes effect only after next sync.",
            enumChoices: [
                "furigana",
                "kana",
                "kanji",
                "tts",
                "tags",
                "rtl"
            ],
            enumPicker: "checkbox",
        },
        {
            key: "debug",
            type: "enum",
            default: [],
            title: "Enable debugging? (Recommended: None)",
            enumChoices: [
                "syncLogseqToAnki.ts",
                "LogseqProxy.ts",
                "LogseqToHtmlConverter.ts",
                "LazyAnkiNoteManager.ts",
                "blockAndPageHashCache.ts",
            ],
            enumPicker: "checkbox",
            description: "Select the files to enable debugging for.",
        },
    ];
    LogseqProxy.Settings.useSettingsSchema(settingsTemplate);
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings: PluginSettings, oldSettings: PluginSettings) => {
        if (oldSettings.addonsList === undefined) oldSettings.addonsList = [];
        if (!_.isEqual(newSettings.addonsList, oldSettings.addonsList)) {
            for (const addon of oldSettings.addonsList) {
                AddonRegistry.get(addon).remove();
            }
            for (const addon of newSettings.addonsList) {
                AddonRegistry.get(addon).init();
            }
        }
        else if (!_.isEqual(newSettings.renderClozeMarcosInLogseq, oldSettings.renderClozeMarcosInLogseq)) {
            WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
        }
        else if (!_.isEqual(newSettings.hideClozeMarcosUntilHoverInLogseq, oldSettings.hideClozeMarcosUntilHoverInLogseq)) {
            WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
        }

        // Handle overwriting list
        if (!_.isEqual(newSettings.syncOverwriteList, oldSettings.syncOverwriteList)) {
            if (!newSettings.syncOverwriteList.includes("Content")) {
                logseq.UI.showMsg("Content overwrite cannot be disabled atm.", "warning");
                logseq.updateSettings({ syncOverwriteList: ["Content", ...newSettings.syncOverwriteList] });
            }
            if (!newSettings.syncOverwriteList.includes("Deck")) {
                logseq.UI.showMsg("Deck overwrite cannot be disabled atm.", "warning");
                logseq.updateSettings({ syncOverwriteList: ["Deck", ...newSettings.syncOverwriteList] });
            }
            if (!newSettings.syncOverwriteList.includes("Tags")) {
                logseq.UI.showMsg("Tags overwrite cannot be disabled atm.", "warning");
                logseq.updateSettings({ syncOverwriteList: ["Tags", ...newSettings.syncOverwriteList] });
            }
            if (!newSettings.syncOverwriteList.includes("Suspended")) {
                logseq.UI.showMsg("Suspended overwrite is now disabled. The suspend-anki-card property will no longer work.", "warning");
            }
        }
    });
    const style = document.createElement("style");
    style.innerHTML = `
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner h2 code {
            display: none;
        }
        
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="donationHeading"].heading-item {
            border: none;
        }
    `;
    WindowParentBridge.getHead().appendChild(style);
    logseq.provideStyle(style.innerHTML);   // This is in case above appendChild doesn't work
};
