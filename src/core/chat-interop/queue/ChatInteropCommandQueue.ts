import {createLogger, LoggerCategory} from "../../../logger";
import type {ChatRuntimeCommand} from "../types";

const logger = createLogger(LoggerCategory.CHAT_UI);

type ChatRuntimeCommandHandler = (command: ChatRuntimeCommand) => Promise<void>;
type Unsubscribe = () => void;

/**
 * Bridges commands invoked from Logseq chrome into the mounted assistant-ui runtime.
 */
export class ChatInteropCommandQueue {
    private static readonly pendingCommands: ChatRuntimeCommand[] = [];

    private static readonly handlers = new Set<ChatRuntimeCommandHandler>();

    private static isFlushing = false;

    static enqueue(command: ChatRuntimeCommand): void {
        ChatInteropCommandQueue.pendingCommands.push(command);
        void ChatInteropCommandQueue.flush();
    }

    static subscribe(handler: ChatRuntimeCommandHandler): Unsubscribe {
        ChatInteropCommandQueue.handlers.add(handler);
        void ChatInteropCommandQueue.flush();

        return () => {
            ChatInteropCommandQueue.handlers.delete(handler);
        };
    }

    private static async flush(): Promise<void> {
        if (ChatInteropCommandQueue.isFlushing) return;
        ChatInteropCommandQueue.isFlushing = true;

        try {
            while (ChatInteropCommandQueue.pendingCommands.length > 0) {
                const handler = ChatInteropCommandQueue.getCurrentHandler();
                if (!handler) return;

                const command = ChatInteropCommandQueue.pendingCommands[0];
                try {
                    await handler(command);
                } catch (error) {
                    logger.error("Failed to execute queued AI Chat command", error);
                } finally {
                    if (ChatInteropCommandQueue.pendingCommands[0] === command) {
                        ChatInteropCommandQueue.pendingCommands.shift();
                    }
                }
            }
        } finally {
            ChatInteropCommandQueue.isFlushing = false;

            if (
                ChatInteropCommandQueue.pendingCommands.length > 0 &&
                ChatInteropCommandQueue.getCurrentHandler()
            ) {
                void ChatInteropCommandQueue.flush();
            }
        }
    }

    private static getCurrentHandler(): ChatRuntimeCommandHandler | undefined {
        return Array.from(ChatInteropCommandQueue.handlers).at(-1);
    }
}
