/**
 * This module owns the user-facing command system: registering command entry points in
 * Logseq chrome, and producing invocable command objects for the command palette and for
 * native Logseq routes.
 *
 * Not to be confused with `src/core/chat-interop` (one-operation ChatCommand transports)
 * or `src/core/logseq-reversible-transaction-tracker/commands` (reversible graph mutations).
 */

export {
    classifyBlockCommandInvocationContext,
    classifyPageCommandInvocationContext
} from "./classifyCommandInvocationContext";
export {initBuiltInCommandFiles} from "./initBuiltInCommandFiles";
export type {
    BlockCommandInvocationContext,
    BlockContextMenuInvokeCondition,
    CommandCenterInvocationContext,
    CommandInvocationContext,
    ContextMenuCommandInvocationContext,
    PageCommandInvocationContext,
    PageContextMenuInvokeCondition,
    SlashCommandInvocationContext
} from "./types";
