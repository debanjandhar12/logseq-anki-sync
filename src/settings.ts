import {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {AddonRegistry} from "./addons/AddonRegistry";
import {LogseqProxy} from "./logseq/LogseqProxy";
import {DONATE_ICON} from "./constants";

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
            key: "useNamespaceAsDefaultDeck",
            type: "boolean",
            default: true,
            title: "Use namespace as default deck if possible? (Recommended: Enabled)",
            description: "When enabled, the namespace of the page will be set as deck when no deck property is specified.<br/><sub>For example, if a note is in page 'Japanese/Verbs', the deck will be set as 'Japanese'.</sub>",
        },
        {
            key: "defaultDeck",
            type: "string",
            title: "Default Deck:",
            description:
                "The default deck to use for cards when no deck property is specified.<br/> If <code>use-namespace-as-default-deck</code> is enabled, this will be used as the default deck only when page is not in any namespace.",
            default: "Default",
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
            key: "cacheLogseqAPIv1",
            type: "boolean",
            default: true,
            title: "Enable caching Logseq API for improved syncing speed? (Recommended: Enabled) [Experimental]",
            description:
                "Enable active cache for Logseq API. When enabled, syncing will be faster but the plugin may use more memory.  <br/> <sub>NB: It is recommended to disable this option if notes are not getting updated properly.</sub>",
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
            ],
            enumPicker: "checkbox",
            description: "Select the files to enable debugging for.",
        },
    ];
    LogseqProxy.Settings.useSettingsSchema(settingsTemplate);
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
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
            window.parent.LSPluginCore.reload([logseq.baseInfo.id]);
        }
        else if (!_.isEqual(newSettings.hideClozeMarcosUntilHoverInLogseq, oldSettings.hideClozeMarcosUntilHoverInLogseq)) {
            window.parent.LSPluginCore.reload([logseq.baseInfo.id]);
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
    window.parent.document.head.appendChild(style);
    logseq.provideStyle(style.innerHTML);   // This is in case above appendChild doesn't work
};
