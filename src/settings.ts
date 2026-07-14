import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {DONATE_ICON} from "./constants";
import {ContentParsingProviderEnum, ProviderEnum, WebToolsProviderEnum} from "./core/ai-sdk/types";
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
    webToolsProvider?: WebToolsProviderEnum;
    jinaApiKey?: string;
    contentParsingProvider?: ContentParsingProviderEnum;
    unstructuredApiKey?: string;
    unstructuredApiUrl?: string;
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
            description:
                "The base URL for the LLM API provider (e.g. https://api.openai.com/v1). Only required for OpenAI Compatible Provider."
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
            title: "🌐 Web Tools",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "webToolsProvider",
            type: "enum",
            default: WebToolsProviderEnum.DISABLED,
            title: "Web Search Provider",
            description: "Choose how the AI searches the web.",
            enumChoices: Object.values(WebToolsProviderEnum),
            enumPicker: "select"
        },
        {
            key: "jinaApiKey",
            type: "string",
            default: "",
            title: "Jina AI API Key (Mandatory)",
            description:
                "API key for Jina AI (https://jina.ai). Required when Web Search Provider is set to Jina.ai."
        },
        {
            key: "contentParsingHeading",
            title: "Content Parsing (Pdf)",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "contentParsingProvider",
            type: "enum",
            default: ContentParsingProviderEnum.DISABLED,
            title: "Content Parsing Provider",
            description: "Choose how the AI extracts content from PDF files.",
            enumChoices: Object.values(ContentParsingProviderEnum),
            enumPicker: "select"
        },
        {
            key: "unstructuredApiUrl",
            type: "string",
            default: "https://platform-api.transform.unstructured.io/api/v1",
            title: "Unstructured.io Transform API URL (Mandatory)",
            description:
                "Transform API URL associated with the API key. Copy this URL from your Unstructured.io account."
        },
        {
            key: "unstructuredApiKey",
            type: "string",
            default: "",
            title: "Unstructured.io API Key (Mandatory)",
            description:
                "API key for Unstructured.io. Required when Content Parsing Provider is set to Unstructured.io."
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

            // Model Native only works with OpenAI or Google providers
            if (
                newSettings.webToolsProvider === WebToolsProviderEnum.MODEL_NATIVE &&
                newSettings.llmProvider !== ProviderEnum.OPENAI &&
                newSettings.llmProvider !== ProviderEnum.GOOGLE
            ) {
                logseq.UI.showMsg(
                    "Model Native web search is only available with OpenAI or Google providers. Please change the LLM Provider or Web Search Provider.",
                    "error"
                );
                LogseqSettingAccessor.updatePluginSettings({
                    webToolsProvider: WebToolsProviderEnum.DISABLED
                });
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

    const applySettingsVisibility = (settings: PluginSettings) => {
        const {id} = logseq.baseInfo;
        const showLlmApiUrl = settings.llmProvider === ProviderEnum.OPENAI_COMPATIBLE;
        const showJinaApiKey = settings.webToolsProvider === WebToolsProviderEnum.JINA;
        const showUnstructuredApiKey =
            settings.contentParsingProvider === ContentParsingProviderEnum.UNSTRUCTURED;

        logseq.provideStyle({
            key: "hide-llm-api-url",
            style: showLlmApiUrl
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIUrl"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIUrl"] {
                    display: none;
                }
            `
        });

        logseq.provideStyle({
            key: "hide-jina-api-key",
            style: showJinaApiKey
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

        logseq.provideStyle({
            key: "hide-unstructured-api-url",
            style: showUnstructuredApiKey
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="unstructuredApiUrl"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="unstructuredApiUrl"] {
                    display: none;
                }
            `
        });

        logseq.provideStyle({
            key: "hide-unstructured-api-key",
            style: showUnstructuredApiKey
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="unstructuredApiKey"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="unstructuredApiKey"] {
                    display: none;
                }
            `
        });
    };
    applySettingsVisibility(LogseqSettingAccessor.getPluginSettings());
    LogseqSettingAccessor.registerSettingsChangeListener((newSettings) => {
        applySettingsVisibility(newSettings);
    });
};
