import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {ChatToolRegistry} from "./chat-app/tools";
import {DONATE_ICON} from "./constants";
import {ProviderEnum} from "./core/ai-sdk/types";
import {LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqSettingAccessor} from "./logseq/LogseqSettingAccessor";

// Type definitions for plugin settings
export interface PluginSettings {
    disabled: boolean;
    llmProvider?: ProviderEnum;
    llmAPIUrl?: string;
    llmAPIKey?: string;
    llmAPIModel?: string;
    globalAgentInstruction?: string;
    openChatInSidebar?: boolean;
    enableWebTools?: boolean;
    jinaApiKey?: string;
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
            key: "llmProvider",
            type: "enum",
            default: Object.values(ProviderEnum)[0],
            title: "LLM Provider type",
            description: "Chose a supported provider type from the list.",
            enumChoices: Object.values(ProviderEnum),
            enumPicker: "select"
        },
        {
            key: "llmAPIUrl",
            type: "string",
            default: "",
            title: "LLM API Url",
            description: "The base URL for the LLM API provider (e.g. https://api.openai.com/v1)"
        },
        {
            key: "llmAPIKey",
            type: "string",
            default: "",
            title: "LLM API Key",
            description: "The API key for the LLM provider"
        },
        {
            key: "llmAPIModel",
            type: "string",
            default: "gpt-4o",
            title: "LLM Model",
            description: "The model identifier to use (e.g. gpt-4o)"
        },
        {
            key: "globalAgentInstruction",
            type: "string",
            default: "",
            title: "Global Agent Instruction",
            description:
                "Optional instructions sent as part of the system prompt for every AI chat response."
        },
        {
            key: "webToolsHeading",
            title: "🌐 Web Tools (Jina)",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "enableWebTools",
            type: "boolean",
            default: false,
            title: "Enable Web Tools",
            description:
                "When enabled, the web_page_get and web_search tools are made available to the AI."
        },
        {
            key: "jinaApiKey",
            type: "string",
            default: "",
            title: "Jina AI API Key (Mandatory)",
            description:
                "API key for Jina AI (https://jina.ai). Required by the web_page_get and web_search tools."
        },
        {
            key: "displaySettingsHeading",
            title: "🎨 Display Settings",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "openChatInSidebar",
            type: "boolean",
            default: true,
            title: "Open Chat in Sidebar",
            description:
                "When enabled, the AI chat-ui will open in the right sidebar. (Note: Does not work on logseq web.)"
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
    LogseqSettingAccessor.useSettingsSchema(settingsTemplate);
    LogseqSettingAccessor.registerSettingsChangeListener(
        (newSettings: PluginSettings, oldSettings: PluginSettings) => {
            // Handle debug category changes - update logger levels
            if (!_.isEqual(newSettings.debug, oldSettings.debug)) {
                updateLoggerLevels();
            }
            // Handle web tools toggle - rebuild the tool registry so the change takes effect
            if (newSettings.enableWebTools !== oldSettings.enableWebTools) {
                ChatToolRegistry.reset();
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

    // Hide the Jina API key setting when web tools are disabled
    const applyJinaKeyVisibility = (settings: PluginSettings) => {
        const {id} = logseq.baseInfo;
        logseq.provideStyle({
            key: "hide-jina-api-key",
            style: settings.enableWebTools
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="jinaApiKey"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="jinaApiKey"] {
                    display: none;
                }
            `
        });
    };
    applyJinaKeyVisibility(LogseqSettingAccessor.getPluginSettings());
    LogseqSettingAccessor.registerSettingsChangeListener((newSettings) => {
        applyJinaKeyVisibility(newSettings);
    });
};
