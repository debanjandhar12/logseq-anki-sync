import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";

/** Queues submission of the current AI Chat composer text and attachments. */
export class SendComposerCommand implements ChatCommand {
    static readonly TYPE = "send-composer";

    async execute(): Promise<void> {
        ChatInteropCommandQueue.enqueue({type: SendComposerCommand.TYPE});
    }
}
