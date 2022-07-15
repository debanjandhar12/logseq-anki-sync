import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin';
import _ from 'lodash';
import { AddonRegistry } from './addons/AddonRegistry';
import { LogseqProxy } from './LogseqProxy';
export const addSettingsToLogseq = () => {
    const settingsTemplate: SettingSchemaDesc[] = [
    {
        key: "breadcrumbDisplay",
        type: 'enum',
        default: "Show Page name and parent blocks context",
        title: "What to display in the breadcrumb?",
        description: "Pick what to display in the breadcrumb.",
        enumChoices: ["Show Page name only", "Show Page name and parent blocks context"],
        enumPicker: "select"
    },
    {
        key: "includeParentContent",
        type: 'boolean',
        default: false,
        title: "Include parent content in cards? If enabled, the parent content will be included in the cards.",
        description: "Include parent content in cards",
    },
    {
      key: "defaultDeck",
      type: 'string',
      title: "Default Deck:",
      description: "The default deck to use for cards when page is not inside a namespace and no page or block deck property is specified.",
      default: "Default"
    },
    {
      key: "addons",
      type: "enum",
      default: [],
      title: "Addons:",
      enumChoices: AddonRegistry.getAll().map(addon => addon.getName()),
      enumPicker: "checkbox",
      description: "Select the addons to use. Addons are typically lower in quality than the main plugin features. Also, all addons require a restart to take effect.",
    },
    {
      key: "skipOnDependencyHashMatch",
      type: 'boolean',
      default: true,
      title: "Enable skip rendering on DependecyHash match for improved syncing speed?",
      description: "Enable skip rendering on DependecyHash match. NB: It is recomended to disable this option if cards are not getting updated properly.",
    },
    {
      key: "activeCacheForLogseqAPIv0",
      type: 'boolean',
      default: false,
      title: "Enable active cache for Logseq API? (Experimental)",
      description: "Enable active cache for Logseq API. NB: It is extremely unstable. It is recomended to disable this option if cards are not getting updated properly.",
    },
    {
      key: "debug",
      type: "enum",
      default: ["Anki Cloze Macro Display"],
      title: "Enable debugging?",
      enumChoices: ["syncLogseqToAnki.ts", "Converter.ts", "LazyAnkiNoteManager.ts"],
      enumPicker: "checkbox",
      description: "Select the files to enable debugging for.",
    },
  ];
  logseq.useSettingsSchema(settingsTemplate);
  logseq.onSettingsChanged((newSettings, oldSettings) => {
    if(newSettings.activeCacheForLogseqAPIv0 != oldSettings.activeCacheForLogseqAPIv0) {
      if(!logseq.settings.activeCacheForLogseqAPIv0) LogseqProxy.Cache.removeActiveCacheListeners();
      else LogseqProxy.Cache.setUpActiveCacheListeners();
    }
    if(!_.isEqual(newSettings.addons, oldSettings.addons)) {
      for(let addon of oldSettings.addons) {
        AddonRegistry.get(addon).remove();
      }
      for(let addon of newSettings.addons) {
        AddonRegistry.get(addon).init();
      }
    }
  });
};