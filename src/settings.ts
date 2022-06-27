import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin';
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
        key: "previewNotesInAnki",
        type: 'boolean',
        default: false,
        title: "Show Preview notes Context Menu (Experimental)",
        description: "Shows a 'Preview notes from block in Anki' Context Menu",
    },
    {
      key: "skipOnDependencyHashMatch",
      type: 'boolean',
      default: true,
      title: "Enable skip rendering on DependecyHash match? (Experimental)",
      description: "Enable skip rendering on DependecyHash match. NB: It is recomended to disable this option if cards are not getting updated properly.",
    },
    {
      key: "debug",
        type: "enum",
        default: [],
        title: "Enable debugging?",
        enumChoices: ["syncLogseqToAnki.ts", "Converter.ts", "LazyAnkiNoteManager.ts"],
        enumPicker: "checkbox",
        description: "Select the files to enable debugging for.",
    },
  ];
    logseq.useSettingsSchema(settingsTemplate);
};