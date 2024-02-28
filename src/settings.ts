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
            key: "generalSettingsHeading",
            title: "🐱 General Settings",
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
            key: "defaultDeck",
            type: "string",
            title: "Default Deck:",
            description:
                "The default deck to use for cards when page is not inside a namespace and no page or block deck property is specified.",
            default: "Default",
        },
        {
            key: "deckFromLogseqNamespace",
            type: "boolean",
            default: true,
            title: "Auto create anki deck from logseq namespace? (Recommended: Enabled)",
            description:
                'When enabled, namespaces from logseq will be used to create decks in anki.  <br/> For example, if the page is in namespace "Math/Algebra", the card will be placed inside "Math" deck.',
        },
        {
            key: "othersHeading",
            title: "😼 Other Settings",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "addons",
            type: "enum",
            default: ["Preview Cards in Anki"],
            title: "Addons:",
            enumChoices: AddonRegistry.getAll().map((addon) => addon.getName()),
            enumPicker: "checkbox",
            description:
                "Select the addons to use.",
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
            key: "advancedSettingsHeading",
            title: "🐯 Advanced Settings",
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
                "Enable active cache for Logseq API. When enabled, the Logseq API and hashes of blocks will be cached and actively maintained in memory.  <br/> NB: It is recommended to disable this option if notes are not getting updated properly.",
        },
        {
            key: "debug",
            type: "enum",
            default: [],
            title: "Enable debugging? (Recommended: None)",
            enumChoices: [
                "syncLogseqToAnki.ts",
                "LogseqProxy.ts",
                "Converter.ts",
                "LazyAnkiNoteManager.ts",
            ],
            enumPicker: "checkbox",
            description: "Select the files to enable debugging for.",
        },
    ];
    LogseqProxy.Settings.useSettingsSchema(settingsTemplate);
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
        if (oldSettings.addons === undefined) oldSettings.addons = [];
        if (!_.isEqual(newSettings.addons, oldSettings.addons)) {
            for (const addon of oldSettings.addons) {
                AddonRegistry.get(addon).remove();
            }
            for (const addon of newSettings.addons) {
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
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner code {
            display: none;
        }
        
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="donationHeading"].heading-item {
            border: none;
        }
    `;
    window.parent.document.head.appendChild(style);
    logseq.provideStyle(style.innerHTML);   // This is in case above appendChild doesn't work
};
