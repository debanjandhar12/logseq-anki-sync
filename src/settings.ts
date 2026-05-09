import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {AddonRegistry} from "./addons/AddonRegistry";
import {DONATE_ICON} from "./constants";
import {LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqAppInfoFetcher} from "./logseq/LogseqAppInfoFetcher";
import {LogseqProxy} from "./logseq/LogseqProxy";
import {WindowParentBridge} from "./logseq/WindowParentBridge";

// Type definitions for plugin settings
export interface PluginSettings {
    disabled: boolean;
    enableExperimentalWebSync?: boolean;
    breadcrumbDisplayOptions?: ("Page name" | "Page namespace" | "Parent blocks")[];
    includeParentContent?: boolean;
    renderClozeMarcosInLogseq?: boolean;
    hideClozeMarcosUntilHoverInLogseq?: boolean;
    addonsList?: string[];
    ankiFieldOptions?: ("furigana" | "kana" | "kanji" | "tts" | "tags" | "rtl")[];
    syncOverwriteList?: string[];
    inheritPropertiesFromTags?: boolean;
    debug?: LoggerCategory[];
    skipOnDependencyHashMatch?: boolean;
    lastWelcomeVersion?: string;
}

export const addSettingsToLogseq = async () => {
    const settingsTemplate: SettingSchemaDesc[] = [
        {
            key: "donationHeading",
            title: "",
            description: `<a href="https://github.com/sponsors/debanjandhar12" target="_blank"><img alt="Donate" style="margin-top:-20px; height: 28px;" src="${DONATE_ICON}" /></a>`,
            type: "heading",
            default: null
        },
        {
            key: "ankiDisplaySettingsHeading",
            title: "📇 Anki Display & Deck",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "breadcrumbDisplayOptions",
            type: "enum",
            default: ["Page name"],
            title: "What to display in the breadcrumb? (Recommended: Page name only)",
            description:
                "Choose what to display in the Anki card breadcrumb. Page namespace requires page name to be enabled.",
            enumChoices: ["Page name", "Page namespace", "Parent blocks"],
            enumPicker: "checkbox"
        },
        {
            key: "includeParentContent",
            type: "boolean",
            default: true,
            title: "Include parent content in cards? (Recommended: Enabled)",
            description: "When enabled, the parent blocks content will be shown in the card."
        },
        {
            key: "logseqSideSettingsHeading",
            title: "🐾 Logseq Menu & Display",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "renderClozeMarcosInLogseq",
            type: "boolean",
            default: false,
            title: "Render cloze macros in Logseq? (Recommended: Disabled) [Experimental] [In Development]",
            description:
                "When enabled, markdown used inside ({{c1 Hello}}, {{c2 World}}, ...) clozes will be rendered."
        },
        {
            key: "hideClozeMarcosUntilHoverInLogseq",
            type: "boolean",
            default: false,
            title: "Hide cloze macros in Logseq? (Recommended: Disabled) [Experimental]",
            description:
                "When enabled, ({{c1 Hello}}, {{c2 World}}, ...) clozes will be hidden by default and displayed only on hover."
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
            default: null
        },
        {
            key: "syncOverwriteList",
            type: "enum",
            default: ["Template", "Content", "Deck", "Tags", "Suspended"],
            title: "Overwrite following on every sync: (Recommended: All)",
            description:
                "This option allows you to set what will be overwritten when sync is performed for a card.",
            enumChoices: [
                "Template",
                "Content",
                "Deck",
                "Tags",
                "Suspended",
                "User Controlled Fields"
            ],
            enumPicker: "checkbox"
        },
        {
            key: "inheritPropertiesFromTags",
            type: "boolean",
            default: false,
            title: "Inherit properties from tags? (Recommended: Disabled)",
            description: "When enabled, properties from tags will be inherited."
        },
        {
            key: "enableExperimentalWebSync",
            type: "boolean",
            default: false,
            title: "Enable experimental web sync? (Experimental)",
            description:
                "When enabled, allows syncing in Logseq Web version. Note that image files cannot be synced in web version."
        },
        {
            key: "ankiFieldOptions",
            type: "enum",
            default: [],
            title: "Select different field options to apply to Anki cards? (Recommended: None)",
            description:
                "This option allows you to add different filters and additional stuff to the Anki card templates. " +
                "Takes effect only after next sync.",
            enumChoices: ["furigana", "kana", "kanji", "tts", "tags", "rtl"],
            enumPicker: "checkbox"
        },
        {
            key: "debug",
            type: "enum",
            default: [],
            title: "Enable info-level logging for categories? (Recommended: None)",
            enumChoices: Object.values(LoggerCategory),
            enumPicker: "checkbox",
            description:
                "Select the categories to enable info-level logging for. Warnings and errors are always shown."
        }
    ];
    LogseqProxy.Settings.useSettingsSchema(settingsTemplate);
    LogseqProxy.Settings.registerSettingsChangeListener(
        (newSettings: PluginSettings, oldSettings: PluginSettings) => {
            if (oldSettings.addonsList === undefined) oldSettings.addonsList = [];
            if (!_.isEqual(newSettings.addonsList, oldSettings.addonsList)) {
                for (const addon of oldSettings.addonsList) {
                    AddonRegistry.get(addon).remove();
                }
                for (const addon of newSettings.addonsList) {
                    AddonRegistry.get(addon).init();
                }
            } else if (
                !_.isEqual(
                    newSettings.renderClozeMarcosInLogseq,
                    oldSettings.renderClozeMarcosInLogseq
                )
            ) {
                WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
            } else if (
                !_.isEqual(
                    newSettings.hideClozeMarcosUntilHoverInLogseq,
                    oldSettings.hideClozeMarcosUntilHoverInLogseq
                )
            ) {
                WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
            }

            // Handle debug category changes - update logger levels
            if (!_.isEqual(newSettings.debug, oldSettings.debug)) {
                updateLoggerLevels();
            }

            // Handle overwriting list
            if (!_.isEqual(newSettings.syncOverwriteList, oldSettings.syncOverwriteList)) {
                if (!newSettings.syncOverwriteList.includes("Template")) {
                    logseq.UI.showMsg("Template overwrite cannot be disabled atm.", "error");
                    logseq.updateSettings({
                        syncOverwriteList: ["Template", ...newSettings.syncOverwriteList]
                    });
                }
                if (!newSettings.syncOverwriteList.includes("Content")) {
                    logseq.UI.showMsg("Content overwrite cannot be disabled atm.", "error");
                    logseq.updateSettings({
                        syncOverwriteList: ["Content", ...newSettings.syncOverwriteList]
                    });
                }
                if (!newSettings.syncOverwriteList.includes("Deck")) {
                    logseq.UI.showMsg("Deck overwrite cannot be disabled atm.", "error");
                    logseq.updateSettings({
                        syncOverwriteList: ["Deck", ...newSettings.syncOverwriteList]
                    });
                }
                if (!newSettings.syncOverwriteList.includes("Tags")) {
                    logseq.UI.showMsg("Tags overwrite cannot be disabled atm.", "error");
                    logseq.updateSettings({
                        syncOverwriteList: ["Tags", ...newSettings.syncOverwriteList]
                    });
                }
                if (!newSettings.syncOverwriteList.includes("Suspended")) {
                    logseq.UI.showMsg(
                        "Suspended overwrite is now disabled. The suspend-anki-card property will no longer work.",
                        "warning"
                    );
                }
                if (newSettings.syncOverwriteList.includes("User Controlled Fields")) {
                    logseq.UI.showMsg(
                        "User Controlled Fields overwrite cannot be enabled. These are user controlled fields for user to store additional details in anki.",
                        "error"
                    );
                    logseq.updateSettings({
                        syncOverwriteList: newSettings.syncOverwriteList.filter(
                            (field) => field !== "User Controlled Fields"
                        )
                    });
                }
            }

            if (
                !_.isEqual(
                    newSettings.breadcrumbDisplayOptions,
                    oldSettings.breadcrumbDisplayOptions
                )
            ) {
                // Page namespace requires page name to be enabled
                if (
                    newSettings.breadcrumbDisplayOptions?.includes("Page namespace") &&
                    !newSettings.breadcrumbDisplayOptions?.includes("Page name")
                ) {
                    logseq.UI.showMsg(
                        "Page namespace requires page name to be enabled. Enabling page name.",
                        "warning"
                    );
                    logseq.updateSettings({
                        breadcrumbDisplayOptions: [
                            "Page name",
                            ...newSettings.breadcrumbDisplayOptions
                        ]
                    });
                }
            }
        }
    );
    logseq.provideStyle(`
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner h2 code {
            display: none;
        }
        
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="donationHeading"].heading-item {
            border: none;
        }
    `);

    // Hide inheritPropertiesFromTags setting for non-DB graphs
    const isDbGraph = await LogseqAppInfoFetcher.checkCurrentIsDbGraph();
    logseq.provideStyle({
        key: "hide-inherit-properties-from-tags",
        style: isDbGraph
            ? ``
            : `
            [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="inheritPropertiesFromTags"] {
                display: none;
            }
        `
    });

    // Show enableExperimentalWebSync setting only in web version
    const isWebVersion = !LogseqAppInfoFetcher.checkHostAccess();
    logseq.provideStyle({
        key: "show-experimental-web-sync",
        style: isWebVersion
            ? ``
            : `
            [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="enableExperimentalWebSync"] {
                display: none;
            }
        `
    });
};
