import '@logseq/libs';
import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin';

export const settingsTemplate: SettingSchemaDesc[] = [{
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