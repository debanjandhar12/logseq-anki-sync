import type {AssistantClient} from "@assistant-ui/react";
import {useEffect} from "react";
import type {ChatRuntimeCommand} from "../../core/chat-interop";
import {ChatInteropCommandQueue, NewThreadCommand} from "../../core/chat-interop";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useChatCommandHandler(aui: AssistantClient): void {
    useEffect(() => {
        return ChatInteropCommandQueue.subscribe(async (command) => {
            await executeRuntimeCommand(aui, command);
        });
    }, [aui]);
}

async function executeRuntimeCommand(
    aui: AssistantClient,
    command: ChatRuntimeCommand
): Promise<void> {
    try {
        if (command.type === NewThreadCommand.TYPE) {
            await aui.threads().switchToNewThread();
        }
    } catch (error) {
        logger.error("Failed to execute AI Chat runtime command", error);
    }
}
