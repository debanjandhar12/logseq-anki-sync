import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {DONATE_ICON, LogseqModelAction} from "./constants";
import {DEFAULT_OPENAI_COMPATIBLE_BASE_URL} from "./core/ai-sdk/provider-config/constants";
import {encodeProviderConfigs} from "./core/ai-sdk/provider-config/providerConfigCodec";
import {ProviderTypeEnum, type ReasoningEffort, WebToolsProviderEnum} from "./core/ai-sdk/types";
import {LoggerCategory, updateLoggerLevels} from "./logger";
import {LogseqSettingAccessor} from "./logseq/LogseqSettingAccessor";
import {showCommandEditorModal} from "./ui/launchers/showCommandEditorModal";
import {showProviderConfigModal} from "./ui/launchers/showProviderConfigModal";
import {showSkillEditorModal} from "./ui/launchers/showSkillEditorModal";

// Remove when @logseq/libs includes the settings button schema.
// Added temporarily until typing based on https://github.com/logseq/logseq/pull/13105 is released.
type SettingsButtonSchemaDesc = Omit<SettingSchemaDesc, "type"> & {
    type: "button";
    buttonText: string;
    buttonAction: string;
};

const DEFAULT_PROVIDER_CONFIG_SETTING = encodeProviderConfigs([
    {
        id: "opencode-zen",
        type: ProviderTypeEnum.OPENAI_COMPATIBLE,
        baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
        apiKey: "test",
        models: [{id: "big-pickle", enabled: true}]
    }
]);

// Type definitions for plugin settings
export interface PluginSettings {
    disabled: boolean;
    providerConfigSetting?: string;
    globalAgentInstruction?: string;
    openChatInSidebar?: boolean;
    webToolsProvider?: WebToolsProviderEnum;
    jinaApiKey?: string;
    debug?: LoggerCategory[];
    // used as storage during runtime
    lastWelcomeVersion?: string;
    selectedModelId?: string;
    selectedModelReasoningEffort?: ReasoningEffort;
}

export const addSettingsToLogseq = async () => {
    logseq.provideModel({
        [LogseqModelAction.OPEN_PROVIDER_CONFIG_SETTINGS]: () => {
            void showProviderConfigModal().catch(() => undefined);
        },
        [LogseqModelAction.OPEN_SKILL_EDITOR_SETTINGS]: () => {
            void showSkillEditorModal().catch(() => undefined);
        },
        [LogseqModelAction.OPEN_COMMAND_EDITOR_SETTINGS]: () => {
            void showCommandEditorModal().catch(() => undefined);
        }
    });

    const settingsTemplate: Array<SettingSchemaDesc | SettingsButtonSchemaDesc> = [
        {
            key: "donationHeading",
            title: "",
            description: `<a href="https://github.com/sponsors/debanjandhar12" target="_blank"><img alt="Donate" style="margin-top:-20px; height: 28px;" src="${DONATE_ICON}" /></a>`,
            type: "heading",
            default: null
        },
        {
            key: "mainSettingsHeading",
            title: "💬 Main",
            description: "",
            type: "heading",
            default: null
        },
        {
            key: "openProviderConfigButton",
            type: "button",
            default: null,
            title: "Provider Configurations",
            description: "Create and manage LLM provider configurations.",
            buttonText: "Open Provider Configurations",
            buttonAction: LogseqModelAction.OPEN_PROVIDER_CONFIG_SETTINGS
        },
        {
            key: "providerConfigSetting",
            type: "string",
            default: DEFAULT_PROVIDER_CONFIG_SETTING,
            title: "Provider Configurations Storage",
            description: "Internal storage for provider configurations."
        },
        {
            key: "openCommandEditorButton",
            type: "button",
            default: null,
            title: "Command Editor",
            description: "Create and manage reusable AI commands.",
            buttonText: "Open Command Editor",
            buttonAction: LogseqModelAction.OPEN_COMMAND_EDITOR_SETTINGS
        },
        {
            key: "openSkillEditorButton",
            type: "button",
            default: null,
            title: "Skill Editor",
            description: "Create and manage skills available to the AI assistant.",
            buttonText: "Open Skill Editor",
            buttonAction: LogseqModelAction.OPEN_SKILL_EDITOR_SETTINGS
        },
        {
            key: "globalAgentInstruction",
            type: "string",
            inputAs: "textarea",
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
    LogseqSettingAccessor.useSettingsSchema(settingsTemplate as SettingSchemaDesc[]);
    LogseqSettingAccessor.registerSettingsChangeListener(
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

        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="providerConfigSetting"] {
            display: none;
        }
    `);

    const applySettingsVisibility = (settings: PluginSettings) => {
        const {id} = logseq.baseInfo;
        const showJinaApiKey = settings.webToolsProvider === WebToolsProviderEnum.JINA;

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
    };
    applySettingsVisibility(LogseqSettingAccessor.getPluginSettings());
    LogseqSettingAccessor.registerSettingsChangeListener((newSettings) => {
        applySettingsVisibility(newSettings);
    });
};
