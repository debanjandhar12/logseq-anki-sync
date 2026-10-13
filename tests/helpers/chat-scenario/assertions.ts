import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";

export async function waitForSavedConversation(threadId: string, expectedText: string) {
    await expect
        .poll(async () => {
            const thread = await ThreadStore.loadThread(threadId);
            const repository = thread?.exportedMessageRepository;
            return repository?.messages.some(
                ({message}) =>
                    message.role === "assistant" &&
                    message.status.type === "complete" &&
                    message.content.some(
                        (part) => part.type === "text" && part.text.includes(expectedText)
                    )
            );
        })
        .toBe(true);
    return (await ThreadStore.loadThread(threadId))!.exportedMessageRepository!;
}

export function findToolPart(repository: ExportedMessageRepository, toolCallId: string) {
    for (const {message} of repository.messages) {
        for (const part of message.content) {
            if (part.type === "tool-call" && part.toolCallId === toolCallId) return part;
        }
    }
    throw new Error(`Tool call ${toolCallId} was not persisted`);
}

export function normalizeRepository(repository: ExportedMessageRepository | undefined) {
    return JSON.parse(JSON.stringify(repository));
}
