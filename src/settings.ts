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
    llmAPIModelList?: string;
    globalAgentInstruction?: string;
    openChatInSidebar?: boolean;
    webToolsProvider?: WebToolsProviderEnum;
    jinaApiKey?: string;
    contentParsingProvider?: ContentParsingProviderEnum;
    llamaCloudApiKey?: string;
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
            default: "https://opencode.ai/zen/v1",
            title: "LLM API Url",
            description: "The base URL for the LLM API provider (e.g. https://opencode.ai/zen/v1)."
        },
        {
            key: "llmAPIKey",
            type: "string",
            default: "",
            title: "LLM API Key",
            description: "The API key for the LLM provider"
        },
        {
            key: "llmAPIModelList",
            type: "string",
            default: "big-pickle",
            title: "LLM Model List",
            description:
                "Comma-separated model identifiers. For example: big-pickle,glm-5.2"
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
            key: "llamaCloudApiKey",
            type: "string",
            default: "",
            title: "LlamaCloud API Key (Mandatory)",
            description:
                "API key for LlamaCloud. Required when Content Parsing Provider is set to LlamaCloud."
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
        const showLlamaCloudApiKey =
            settings.contentParsingProvider === ContentParsingProviderEnum.LLAMA_CLOUD;

        logseq.provideStyle({
            key: "hide-llm-api-url",
            style: showLlmApiUrl
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIUrl"] {
                    display: block !important;
                }
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIModelList"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIUrl"] {
                    display: none;
                }
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llmAPIModelList"] {
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
            key: "hide-llama-cloud-api-key",
            style: showLlamaCloudApiKey
                ? `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llamaCloudApiKey"] {
                    display: block !important;
                }
            `
                : `
                [data-id="${id}"] .cp__plugins-settings-inner [data-key="llamaCloudApiKey"] {
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
