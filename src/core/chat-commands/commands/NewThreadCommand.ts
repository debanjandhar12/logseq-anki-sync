import {CommandQueue} from "../CommandQueue";
import type {ChatCommand} from "../types";
import {CHAT_RUNTIME_COMMAND_TYPES} from "../types";
import {OpenAIChatCommand} from "./OpenAIChatCommand";

/**
 * Creates a new AI Chat thread.
 */
export class NewThreadCommand implements ChatCommand {
    constructor(private readonly openAIChatCommand: ChatCommand = new OpenAIChatCommand()) {}

    async execute(): Promise<void> {
        CommandQueue.enqueue({type: CHAT_RUNTIME_COMMAND_TYPES.NEW_THREAD});
        await this.openAIChatCommand.execute();
    }
}
