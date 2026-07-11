import type {ChatModelAdapter, ThreadHistoryAdapter} from "@assistant-ui/react";

export function withRoundtripPersistence(
    chatModel: ChatModelAdapter,
    history: ThreadHistoryAdapter
): ChatModelAdapter {
    return {
        async *run(options) {
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
        }
    };
}
