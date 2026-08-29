import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";

/** Replaces the AI Chat composer text without sending it. */
export class SetComposerTextCommand implements ChatCommand {
    static readonly TYPE = "set-composer-text";

    constructor(private readonly text: string) {}

    async execute(): Promise<void> {
        ChatInteropCommandQueue.enqueue({
            type: SetComposerTextCommand.TYPE,
            payload: {text: this.text}
        });
    }
}
