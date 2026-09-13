import {expect} from "vitest";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";

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
