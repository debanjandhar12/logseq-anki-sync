import type {
    BLOCK_CONTEXT_MENU_INVOKE_CONDITIONS,
    PAGE_CONTEXT_MENU_INVOKE_CONDITIONS
} from "../command-parser";

export type BlockContextMenuInvokeCondition = (typeof BLOCK_CONTEXT_MENU_INVOKE_CONDITIONS)[number];

export type PageContextMenuInvokeCondition = (typeof PAGE_CONTEXT_MENU_INVOKE_CONDITIONS)[number];

export interface BlockCommandInvocationContext {
    source: "block-context-menu";
    condition: BlockContextMenuInvokeCondition;
    uuid: string;
}

export interface PageCommandInvocationContext {
    source: "page-context-menu";
    condition: PageContextMenuInvokeCondition;
    uuid: string;
}

export interface SlashCommandInvocationContext {
    source: "block-slash-command";
    condition: "Block Slash Command";
    uuid: string;
}

export interface CommandCenterInvocationContext {
    source: "command-center";
    condition: "Logseq Command Center";
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
