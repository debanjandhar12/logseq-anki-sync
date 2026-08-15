import type {ChatModelAdapter, ThreadHistoryAdapter} from "@assistant-ui/react";
import {trackThreadRun} from "./thread-run";

export function withRoundtripPersistence(
    chatModel: ChatModelAdapter,
    history: ThreadHistoryAdapter,
    threadId: string
): ChatModelAdapter {
    return {
        async *run(options) {
            // Public isRunning can be false while a frontend tool still owns this adapter run.
            const endRun = trackThreadRun(threadId);
            try {
                const result = chatModel.run(options);
                if (Symbol.asyncIterator in result) {
                    yield* result;
                } else {
                    yield await result;
                }

                const message = options.unstable_getMessage();
                if (
                    message.role === "assistant" &&
                    message.status.type !== "complete" &&
                    message.status.type !== "incomplete"
                ) {
                    await history.append({
                        parentId: options.unstable_parentId ?? null,
                        message,
                        runConfig: options.runConfig
                    });
                }
            } finally {
                endRun();
            }
        }
    };
}
