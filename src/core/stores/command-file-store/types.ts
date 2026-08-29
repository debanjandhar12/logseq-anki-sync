export const BLOCK_CONTEXT_MENU_INVOKE_CONDITIONS = [
    "Block Context Menu/Image",
    "Block Context Menu/Pdf",
    "Block Context Menu/Video",
    "Block Context Menu/Flashcard",
    "Block Context Menu/Other Blocks"
] as const;

export const PAGE_CONTEXT_MENU_INVOKE_CONDITIONS = [
    "Page Context Menu/Tag",
    "Page Context Menu/Property",
    "Page Context Menu/Journal",
    "Page Context Menu/Other Pages"
] as const;

export const COMMAND_INVOKE_CONDITIONS = [
    ...BLOCK_CONTEXT_MENU_INVOKE_CONDITIONS,
    ...PAGE_CONTEXT_MENU_INVOKE_CONDITIONS,
    "Logseq Command Center",
    "Block Slash Command"
] as const;

export type CommandInvokeCondition = (typeof COMMAND_INVOKE_CONDITIONS)[number];

export interface CommandFileData {
    name: string;
    invokeConditions: CommandInvokeCondition[];
    userInvocable: boolean;
    commandInvokeInNewThread: boolean;
    commandAppearSeparatelyInContextMenu: boolean;
    content: string;
    builtInCommand?: boolean;
    builtInCommandUserControllable?: boolean;
}
