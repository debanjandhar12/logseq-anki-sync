import {describe, expect, test, vi} from "vitest";
import {ChatInteropCommandQueue} from "../../../../src/core/chat-interop/queue/ChatInteropCommandQueue";

async function waitForQueue(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ChatInteropCommandQueue", () => {
    test("retains commands until a runtime subscribes and preserves FIFO order", async () => {
        ChatInteropCommandQueue.enqueue({type: "clear-composer"});
        ChatInteropCommandQueue.enqueue({type: "set-composer-text", payload: {text: "Prompt"}});
        const handler = vi.fn().mockResolvedValue(undefined);

        const unsubscribe = ChatInteropCommandQueue.subscribe(handler);
        await waitForQueue();
        unsubscribe();

        expect(handler.mock.calls.map(([command]) => command)).toEqual([
            {type: "clear-composer"},
            {type: "set-composer-text", payload: {text: "Prompt"}}
        ]);
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
