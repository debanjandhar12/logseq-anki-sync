import {CommandRegistry} from "./CommandRegistry";
import {InitAIChatCommand} from "./commands/InitAIChatCommand";
import {NewThreadCommand} from "./commands/NewThreadCommand";
import {OpenAIChatCommand} from "./commands/OpenAIChatCommand";
import {CHAT_COMMAND_TYPES} from "./types";

export {CommandQueue} from "./CommandQueue";
export {CommandRegistry} from "./CommandRegistry";
export {AddLogseqBlockAsAttachmentCommand} from "./commands/AddLogseqBlockAsAttachmentCommand";
export {InitAIChatCommand} from "./commands/InitAIChatCommand";
export {NewThreadCommand} from "./commands/NewThreadCommand";
export {OpenAIChatCommand} from "./commands/OpenAIChatCommand";
export type {ChatCommand, ChatCommandType, ChatRuntimeCommand} from "./types";
export {CHAT_COMMAND_TYPES, CHAT_RUNTIME_COMMAND_TYPES} from "./types";

CommandRegistry.register(CHAT_COMMAND_TYPES.INIT_AI_CHAT, new InitAIChatCommand());
CommandRegistry.register(CHAT_COMMAND_TYPES.OPEN_AI_CHAT, new OpenAIChatCommand());
CommandRegistry.register(CHAT_COMMAND_TYPES.NEW_THREAD, new NewThreadCommand());