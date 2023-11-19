import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import { AddonRegistry } from "./addons/AddonRegistry";
import { LogseqProxy } from "./logseq/LogseqProxy";
import { DONATE_ICON } from "./constants";

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
            description:
                "When enabled, the parent blocks content will be shown in the card.",
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
                "Select the addons to use. Note: All addons activate / deactivate only after restart.",
        },
        {
            key: "renderAnkiClozeMarcosInLogseq",
            type: "enum",
            default: "",
            title: "Render Anki Cloze Macros by plugin in Logseq? (Recommended: Off) [Experimental] [In Development]",
            description:
                "When enabled, the Anki Cloze Macros ({{c1 Pikachu}}, {{c2 Mew}}, ...) will be rendered as normal text or blanks that turn visible on hover. Refresh or reopen Logseq to take effect.",
            enumChoices: [
                "Off",
                "On",
                "On hover",
            ],
            enumPicker: "select",
        },
        {
            key: "advancedSettingsHeading",
            title: "🐯 Advanced Settings",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "skipOnDependencyHashMatch",
            type: "boolean",
            default: true,
            title: "Enable skip on DependecyHash match for improved syncing speed? (Recommended: Enabled)",
            description: "Enable skip rendering on DependecyHash match.",
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
    LogseqProxy.Settings.registerSettingsChangeListener(
        (newSettings, oldSettings) => {
            if (oldSettings.addons === undefined) oldSettings.addons = [];
            if (!_.isEqual(newSettings.addons, oldSettings.addons)) {
                for (const addon of oldSettings.addons) {
                    AddonRegistry.get(addon).remove();
                }
                for (const addon of newSettings.addons) {
                    AddonRegistry.get(addon).init();
                }
            }
        },
    );
    logseq.provideStyle(`
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner code {
            display: none;
        }
        
        [data-id="${logseq.baseInfo.id}"] .cp__plugins-settings-inner [data-key="donationHeading"].heading-item {
            border: none;
        }
    `);
};
