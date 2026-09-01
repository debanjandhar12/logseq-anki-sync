import type {
    BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS,
    PAGE_CONTEXT_MENU_INVOKE_LOCATIONS
} from "../command-parser";

export type BlockContextMenuInvokeLocation = (typeof BLOCK_CONTEXT_MENU_INVOKE_LOCATIONS)[number];

export type PageContextMenuInvokeLocation = (typeof PAGE_CONTEXT_MENU_INVOKE_LOCATIONS)[number];

export interface BlockCommandInvocationContext {
    source: "block-context-menu";
    location: BlockContextMenuInvokeLocation;
    uuid: string;
}

export interface PageCommandInvocationContext {
    source: "page-context-menu";
    location: PageContextMenuInvokeLocation;
    uuid: string;
}

export interface SlashCommandInvocationContext {
    source: "block-slash-command";
    location: "Block Slash Command";
    uuid: string;
}

export interface CommandCenterInvocationContext {
    source: "command-center";
    location: "Logseq Command Center";
}

/** Invocation contexts that are routed through the plugin's own command palette. */
export type ContextMenuCommandInvocationContext =
    | BlockCommandInvocationContext
    | PageCommandInvocationContext;

/** Every route capable of invoking a user command. */
export type CommandInvocationContext =
    | ContextMenuCommandInvocationContext
    | SlashCommandInvocationContext
    | CommandCenterInvocationContext;

/** A stored command bound to the invocation context against which it will run. */
export interface UserCommand {
    name: string;
    builtInCommand: boolean;
    execute(): Promise<void>;
}
