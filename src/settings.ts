import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {DONATE_ICON} from "./constants";
import {LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqProxy} from "./logseq/LogseqProxy";

// Type definitions for plugin settings
export interface PluginSettings {
    disabled: boolean;
    llmProvider?: ("TBU from types")[];
    llmAPIUrl?: string;
    llmAPIKey?: string;
    llmAPIModel?: string;
    debug?: LoggerCategory[];
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
            key: "llmSettingsHeading",
            title: "🤖 LLM Settings",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "llmProviderSetting",
            type: "enum",
            default: ["TBU select first from types"],
            title: "LLM Provider type",
            description:
                "Chose a supported provider type from the list.",
            enumChoices: ["TBU from types"],
            enumPicker: "select"
        },
        {
            key: "llmAPIUrlSetting",
            type: "string",
            default: "",
            title: "LLM API Url",
            description: "TBU"
        },
        {
            key: "advancedSettingsHeading",
            title: "🎓 Advanced Settings",
            description: "",
            type: "heading",
            default: null
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
            // Handle debug category changes - update logger levels
            if (!_.isEqual(newSettings.debug, oldSettings.debug)) {
                updateLoggerLevels();
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
    // TBU: remove below
    // const isDbGraph = await LogseqAppInfoFetcher.checkCurrentIsDbGraph();
    // logseq.provideStyle({
    //     key: "hide-inherit-properties-from-tags",
    //     style: isDbGraph
    //         ? ``
    //         : `
    //         [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="inheritPropertiesFromTags"] {
    //             display: none;
    //         }
    //     `
    // });
};
