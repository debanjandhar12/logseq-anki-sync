import '@logseq/libs';
import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin';

export const settingsTemplate: SettingSchemaDesc[] = [{
  key: "hideNativeFlashcard",
  type: 'boolean',
  default: false,
  title: "Hide Logseq's Native Flashcards",
  description: "Hide Logseq's native flashcards from the left sidebar.",
  },
  {
    key: "breadcrumbDisplay",
    type: 'enum',
    default: "Show Page name and parent blocks context",
    title: "What to display in the breadcrumb?",
    description: "Pick what to display in the breadcrumb. NB: Show Page name and parent blocks context might slightly increase syncing time.",
    enumChoices: ["Show Page name only", "Show Page name and parent blocks context"],
    enumPicker: "select"
  },
  {
  key: "previewNotesInAnki",
  type: 'boolean',
  default: false,
  title: "Show Preview notes Context Menu",
  description: "Shows a 'Preview notes from block in Anki' Context Menu",
  },
  {
    key: "includeParentContent",
    type: 'boolean',
    default: false,
    title: "Include parent content in cards? (Experimental)",
    description: "Include parent content in cards NB: This might increase syncing time as well as size of the cards.",
  },
  {
    key: "syncDebug",
    type: 'boolean',
    default: false,
    title: "Enable Sync Debugging",
    description: "This enables sync debugging mode. In sync debugging mode, the plugin will output more information to the console.",
  },
  {
    key: "converterDebug",
    type: 'boolean',
    default: false,
    title: "Enable Converter Debugging",
    description: "This enables converter debugging mode. In converter debugging mode, the plugin will output more information to the console.",
  }
] 