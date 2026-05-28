import type {ChatRuntimeCommand} from "./types";

type ChatRuntimeCommandHandler = (command: ChatRuntimeCommand) => Promise<void>;
type Unsubscribe = () => void;

/**
 * Bridges commands invoked from Logseq chrome into the mounted assistant-ui runtime.
 */
export class CommandQueue {
    private static readonly pendingCommands: ChatRuntimeCommand[] = [];

    private static readonly handlers = new Set<ChatRuntimeCommandHandler>();

    private static isFlushing = false;

    static enqueue(command: ChatRuntimeCommand): void {
        CommandQueue.pendingCommands.push(command);
        void CommandQueue.flush();
    }

    static subscribe(handler: ChatRuntimeCommandHandler): Unsubscribe {
        CommandQueue.handlers.add(handler);
        void CommandQueue.flush();

        return () => {
            CommandQueue.handlers.delete(handler);
        };
    }

    private static async flush(): Promise<void> {
        if (CommandQueue.isFlushing) return;

        const handler = CommandQueue.getCurrentHandler();
        if (!handler) return;

        CommandQueue.isFlushing = true;

        try {
            while (CommandQueue.pendingCommands.length > 0) {
                const command = CommandQueue.pendingCommands.shift();
                if (!command) continue;
                await handler(command);
            }
        } finally {
            CommandQueue.isFlushing = false;

            if (CommandQueue.pendingCommands.length > 0 && CommandQueue.getCurrentHandler()) {
                void CommandQueue.flush();
            }
        }
    }

    private static getCurrentHandler(): ChatRuntimeCommandHandler | undefined {
        return Array.from(CommandQueue.handlers).at(-1);
    }
}
