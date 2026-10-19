import {describe, expect, test, vi} from "vitest";
import {ChatInteropCommandQueue} from "../../../../src/core/chat-interop/queue/ChatInteropCommandQueue";

async function waitForQueue(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ChatInteropCommandQueue", () => {
    test("retains commands until a runtime subscribes and preserves FIFO order", async () => {
        ChatInteropCommandQueue.enqueue({type: "clear-composer"});
        ChatInteropCommandQueue.enqueue({type: "set-composer-text", payload: {text: "Prompt"}});
        ChatInteropCommandQueue.enqueue({type: "send-composer"});
        const handler = vi.fn().mockResolvedValue(undefined);

        const unsubscribe = ChatInteropCommandQueue.subscribe(handler);
        await waitForQueue();
        unsubscribe();

        expect(handler.mock.calls.map(([command]) => command)).toEqual([
            {type: "clear-composer"},
            {type: "set-composer-text", payload: {text: "Prompt"}},
            {type: "send-composer"}
        ]);
    });

    test("does not send until the preceding runtime handler completes", async () => {
        let completePreparation!: () => void;
        const preparation = new Promise<void>((resolve) => {
            completePreparation = resolve;
        });
        const handler = vi
            .fn()
            .mockImplementationOnce(() => preparation)
            .mockResolvedValue(undefined);
        const unsubscribe = ChatInteropCommandQueue.subscribe(handler);
        try {
            ChatInteropCommandQueue.enqueue({type: "set-composer-text", payload: {text: "Prompt"}});
            ChatInteropCommandQueue.enqueue({type: "send-composer"});
            await waitForQueue();
            expect(handler).toHaveBeenCalledTimes(1);
            completePreparation();
            await waitForQueue();
            expect(handler.mock.calls.map(([command]) => command.type)).toEqual([
                "set-composer-text",
                "send-composer"
            ]);
        } finally {
            completePreparation();
            await waitForQueue();
            unsubscribe();
        }
    });

    test("continues after a handler rejects one command", async () => {
        const handler = vi
            .fn()
            .mockRejectedValueOnce(new Error("Failed"))
            .mockResolvedValue(undefined);
        const unsubscribe = ChatInteropCommandQueue.subscribe(handler);

        ChatInteropCommandQueue.enqueue({type: "clear-composer"});
        ChatInteropCommandQueue.enqueue({type: "set-composer-text", payload: {text: "Prompt"}});
        await waitForQueue();
        unsubscribe();

        expect(handler).toHaveBeenCalledTimes(2);
    });
});
