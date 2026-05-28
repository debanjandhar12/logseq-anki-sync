import {CommandRegistry} from "./CommandRegistry";
import {InitAIChatCommand} from "./commands/InitAIChatCommand";
import {NewThreadCommand} from "./commands/NewThreadCommand";
import {OpenAIChatCommand} from "./commands/OpenAIChatCommand";

export {CommandQueue} from "./CommandQueue";
export {CommandRegistry} from "./CommandRegistry";
export {AddLogseqBlockAsAttachmentCommand} from "./commands/AddLogseqBlockAsAttachmentCommand";
export {InitAIChatCommand} from "./commands/InitAIChatCommand";
export {NewThreadCommand} from "./commands/NewThreadCommand";
export {OpenAIChatCommand} from "./commands/OpenAIChatCommand";
export type {ChatCommand, ChatRuntimeCommand} from "./types";

export const initAIChat = () => CommandRegistry.execute(InitAIChatCommand.TYPE);
export const showAIChat = () => CommandRegistry.execute(OpenAIChatCommand.TYPE);

CommandRegistry.register(new InitAIChatCommand());
CommandRegistry.register(new OpenAIChatCommand());
CommandRegistry.register(new NewThreadCommand());