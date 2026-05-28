import type {AssistantClient} from "@assistant-ui/react";
import {useEffect} from "react";
import type {ChatRuntimeCommand} from "../../core/chat-interop";
import {
    AddLogseqBlockAsAttachmentCommand,
    ChatInteropCommandQueue,
    NewThreadCommand
} from "../../core/chat-interop";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqPropertiesHelper} from "../../logseq/LogseqPropertiesHelper";
import {createLogseqBlockAttachment} from "../runtime/LogseqBlockAttachmentAdapter";

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

        if (command.type === AddLogseqBlockAsAttachmentCommand.TYPE) {
            const uuid = command.payload?.uuid;
            if (typeof uuid !== "string") {
                throw new Error("Cannot add Logseq block attachment without a block UUID.");
            }

            const block = await LogseqPropertiesHelper.getBlock(uuid, {includeChildren: true});
            if (!block) {
                throw new Error(`Logseq block not found: ${uuid}`);
            }

            await aui.composer().addAttachment(createLogseqBlockAttachment(block));
        }
    } catch (error) {
        logger.error("Failed to execute AI Chat runtime command", error);
    }
}
