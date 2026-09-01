export const BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS = [
    "Block Context Menu/Image",
    "Block Context Menu/Pdf",
    "Block Context Menu/Video",
    "Block Context Menu/Flashcard",
    "Block Context Menu/Other Blocks"
] as const;

export const PAGE_CONTEXT_MENU_INVOKE_LOCATIONS = [
    "Page Context Menu/Tag",
    "Page Context Menu/Property",
    "Page Context Menu/Journal",
    "Page Context Menu/Other Pages"
] as const;

export const COMMAND_INVOKE_LOCATIONS = [
    ...BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS,
    ...PAGE_CONTEXT_MENU_INVOKE_LOCATIONS,
    "Logseq Command Center",
    "Block Slash Command"
] as const;

export type CommandInvokeLocation = (typeof COMMAND_INVOKE_LOCATIONS)[number];

export interface CommandFileData {
    name: string;
    invokeLocations: CommandInvokeLocation[];
    userInvocable: boolean;
    commandInvokeInNewThread: boolean;
    commandAppearSeparatelyInContextMenu: boolean;
    content: string;
    builtInCommand?: boolean;
    builtInCommandUserControllable?: boolean;
}
