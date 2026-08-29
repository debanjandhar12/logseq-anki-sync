import type {AssistantClient} from "@assistant-ui/react";
import {useEffect} from "react";
import type {ChatRuntimeCommand} from "../../core/chat-interop";
import {
    AddAttachmentCommand,
    ChatInteropCommandQueue,
    ClearComposerCommand,
    NewThreadCommand,
    SetComposerTextCommand
} from "../../core/chat-interop";
import {createLogger, LoggerCategory} from "../../logger";
import {createLogseqAttachmentFromUuid} from "../runtime/LogseqAttachmentAdapter";

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
            return;
        }

        if (command.type === ClearComposerCommand.TYPE) {
            aui.composer().reset();
            return;
        }

        if (command.type === AddAttachmentCommand.TYPE) {
            await aui
                .composer()
                .addAttachment(await createLogseqAttachmentFromUuid(command.payload.uuid));
            return;
        }

        if (command.type === SetComposerTextCommand.TYPE) {
            aui.composer().setText(command.payload.text);
        }
    } catch (error) {
        logger.error("Failed to execute AI Chat runtime command", error);
    }
}
