import {SettingSchemaDesc} from '@logseq/libs/dist/LSPlugin';
import _ from 'lodash';
import {AddonRegistry} from './addons/AddonRegistry';
import {LogseqProxy} from './logseq/LogseqProxy';

export const addSettingsToLogseq = () => {
    const settingsTemplate: SettingSchemaDesc[] = [
        {
            key: "generalSettingsHeading",
            title: "🐱 General Settings",
            description: "",
            type: "heading",
            default: null,
        },
        {
            key: "breadcrumbDisplay",
            type: 'enum',
            default: "Show Page name only",
            title: "What to display in the breadcrumb? (Default: Show Page name only)",
            description: "Pick what to display in the breadcrumb.",
            enumChoices: ["Dont show breadcrumb", "Show Page name only", "Show Page name and parent blocks context"],
            enumPicker: "select"
        },
        {
            key: "includeParentContent",
            type: 'boolean',
            default: true,
            title: "Include parent content in cards? (Default: Enabled)",
            description: "Include parent content in cards. When enabled, the parent content will be included in the card.",
        },
        {
            key: "defaultDeck",
            type: 'string',
            title: "Default Deck:",
            description: "The default deck to use for cards when page is not inside a namespace and no page or block deck property is specified.",
            default: "Default"
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
            default: [],
            title: "Addons: (Default: None)",
            enumChoices: AddonRegistry.getAll().map(addon => addon.getName()),
            enumPicker: "checkbox",
            description: "Select the addons to use. Note: All addons activate / deactivate only after restart.",
        },
        {
            key: "renderAnkiClozeMarcosInLogseq",
            type: 'boolean',
            default: false,
            title: "Render Anki Cloze Macros in Logseq? (Default: Disabled) [Experimental] [In Development]",
            description: "Render Anki Cloze Macros in Logseq. When enabled, the Anki Cloze Macros ({{c1 Pikachu}}, {{c2 Mew}}, ...) will be rendered in Logseq.",
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
            type: 'boolean',
            default: true,
            title: "Enable skip on DependecyHash match for improved syncing speed? (Default: Enabled)",
            description: "Enable skip rendering on DependecyHash match.",
        },
        {
            key: "cacheLogseqAPIv1",
            type: 'boolean',
            default: true,
            title: "Enable caching Logseq API for improved syncing speed? (Default: Enabled) [Experimental]",
            description: "Enable active cache for Logseq API. When enabled, the Logseq API and hashes of blocks will be cached and maintained in memory. NB: It is recommended to disable this option if notes are not getting updated properly."
        },
        {
            key: "debug",
            type: "enum",
            default: [],
            title: "Enable debugging? (Default: None)",
            enumChoices: ["syncLogseqToAnki.ts", "LogseqProxy.ts", "Converter.ts", "LazyAnkiNoteManager.ts"],
            enumPicker: "checkbox",
            description: "Select the files to enable debugging for.",
        },
    ];
    LogseqProxy.Settings.useSettingsSchema(settingsTemplate);
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
        if (!_.isEqual(newSettings.addons, oldSettings.addons)) {
            for (let addon of oldSettings.addons) {
                AddonRegistry.get(addon).remove();
            }
            for (let addon of newSettings.addons) {
                AddonRegistry.get(addon).init();
            }
        }
    });
};