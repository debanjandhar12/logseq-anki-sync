import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";

/**
 * Creates a new AI Chat thread.
 */
export class NewThreadCommand implements ChatCommand {
    static readonly TYPE = "new-thread";

    async execute(): Promise<void> {
        ChatInteropCommandQueue.enqueue({type: NewThreadCommand.TYPE});
    }
}
