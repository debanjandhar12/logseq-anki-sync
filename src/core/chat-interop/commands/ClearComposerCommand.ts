import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";

/** Clears the complete AI Chat composer draft. */
export class ClearComposerCommand implements ChatCommand {
    static readonly TYPE = "clear-composer";

    async execute(): Promise<void> {
        ChatInteropCommandQueue.enqueue({type: ClearComposerCommand.TYPE});
    }
}
