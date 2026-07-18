import type {AssistantClient} from "@assistant-ui/react";
import {useEffect} from "react";
import type {ChatRuntimeCommand} from "../../core/chat-interop";
import {
    AddAttachmentCommand,
    ChatInteropCommandQueue,
    NewThreadCommand
} from "../../core/chat-interop";
import {createLogger, LoggerCategory} from "../../logger";
import {createLogseqAttachmentFromUuid} from "../runtime/LogseqAttachmentAdapter";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useChatCommandHandler(
    aui: AssistantClient,
    cleanupBeforeNavigation: () => Promise<void>
): void {
    useEffect(() => {
        return ChatInteropCommandQueue.subscribe(async (command) => {
            await executeRuntimeCommand(aui, command, cleanupBeforeNavigation);
        });
    }, [aui, cleanupBeforeNavigation]);
}

async function executeRuntimeCommand(
    aui: AssistantClient,
    command: ChatRuntimeCommand,
    cleanupBeforeNavigation: () => Promise<void>
): Promise<void> {
    try {
        if (command.type === NewThreadCommand.TYPE) {
            await cleanupBeforeNavigation();
            await aui.threads().switchToNewThread();
            return;
        }

        if (command.type === AddAttachmentCommand.TYPE) {
            const uuid = command.payload?.uuid;
            if (typeof uuid !== "string") {
                throw new Error("Cannot add a Logseq attachment without a UUID.");
            }

            await aui.composer().addAttachment(await createLogseqAttachmentFromUuid(uuid));
        }
    } catch (error) {
        logger.error("Failed to execute AI Chat runtime command", error);
    }
}
