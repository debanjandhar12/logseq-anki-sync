import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";
import {OpenAIChatCommand} from "./OpenAIChatCommand";

/**
 * Creates a new AI Chat thread.
 */
export class NewThreadCommand implements ChatCommand {
    static readonly TYPE = "new-thread";

    constructor(private readonly openAIChatCommand: ChatCommand = new OpenAIChatCommand()) {}

    async execute(): Promise<void> {
        ChatInteropCommandQueue.enqueue({type: NewThreadCommand.TYPE});
        await this.openAIChatCommand.execute();
    }
}
