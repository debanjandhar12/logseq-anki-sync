import type {AssistantClient} from "@assistant-ui/react";
import {useEffect} from "react";
import type {ChatRuntimeCommand} from "../../core/chat-commands";
import {CHAT_RUNTIME_COMMAND_TYPES, CommandQueue} from "../../core/chat-commands";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useChatCommandHandler(aui: AssistantClient): void {
    useEffect(() => {
        return CommandQueue.subscribe(async (command) => {
            await executeRuntimeCommand(aui, command);
        });
    }, [aui]);
}

async function executeRuntimeCommand(
    aui: AssistantClient,
    command: ChatRuntimeCommand
): Promise<void> {
    try {
        if (command.type === CHAT_RUNTIME_COMMAND_TYPES.NEW_THREAD) {
            await aui.threads().switchToNewThread();
        }
    } catch (error) {
        logger.error("Failed to execute AI Chat runtime command", error);
    }
}
