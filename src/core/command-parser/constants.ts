import {
    BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS,
    COMMAND_INVOKE_LOCATIONS,
    PAGE_CONTEXT_MENU_INVOKE_LOCATIONS
} from "../stores/command-file-store/types";
import type {CommandFrontmatterFieldDefinition} from "./types";

export const COMMAND_INVOKE_LOCATION_TREE = [
    {
        label: "Block Context Menu",
        children: BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS
    },
    {
        label: "Page Context Menu",
        children: PAGE_CONTEXT_MENU_INVOKE_LOCATIONS
    },
    {label: "Logseq Command Center", value: "Logseq Command Center"},
    {label: "Block Slash Command", value: "Block Slash Command"}
] as const;

export {
    BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS,
    COMMAND_INVOKE_LOCATIONS,
    PAGE_CONTEXT_MENU_INVOKE_LOCATIONS
};

export const COMMAND_FRONTMATTER_FIELDS = [
    {key: "name", dataKey: "name", valueType: "string", required: true},
    {
        key: "invoke-location",
        dataKey: "invokeLocations",
        valueType: "string-array",
        required: true
    },
    {key: "user-invocable", dataKey: "userInvocable", valueType: "boolean"},
    {
        key: "command-invoke-in-new-thread",
        dataKey: "commandInvokeInNewThread",
        valueType: "boolean"
    },
    {
        key: "command-appear-seperately-in-context-menu",
        dataKey: "commandAppearSeparatelyInContextMenu",
        valueType: "boolean"
    },
    {key: "built-in-command", dataKey: "builtInCommand", valueType: "boolean"},
    {
        key: "built-in-command-user-controllable",
        dataKey: "builtInCommandUserControllable",
        valueType: "boolean"
    }
] as const satisfies readonly CommandFrontmatterFieldDefinition[];

export const COMMAND_FRONTMATTER_KEYS = Object.freeze(
    Object.fromEntries(COMMAND_FRONTMATTER_FIELDS.map((field) => [field.dataKey, field.key]))
) as {
    readonly [K in (typeof COMMAND_FRONTMATTER_FIELDS)[number] as K["dataKey"]]: K["key"];
};
