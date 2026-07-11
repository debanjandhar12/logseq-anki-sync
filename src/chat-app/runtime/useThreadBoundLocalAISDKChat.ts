import type {AssistantRuntime} from "@assistant-ui/react";
import {
    CompositeAttachmentAdapter,
    SimpleImageAttachmentAdapter,
    useAuiState,
    useLocalRuntime
} from "@assistant-ui/react";
import {useEffect, useMemo} from "react";
import {ChatToolRegistry} from "../tools";
import {LocalAISDKChatModelAdapter} from "./LocalChatModelAdapter";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";
import {LogseqAttachmentAdapter} from "./LogseqAttachmentAdapter";

/**
 * Creates a thread-bound LocalRuntime backed by the AI SDK.
 */
export function useThreadBoundLocalAISDKChat(): AssistantRuntime {
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const toolRegistry = useMemo(() => ChatToolRegistry.getInstance(), []);

    const historyAdapter = useMemo(() => {
        return new LocalThreadHistoryAdapter(threadId);
    }, [threadId]);

    const attachmentAdapter = useMemo(() => {
        return new CompositeAttachmentAdapter([
            new SimpleImageAttachmentAdapter(), // currently unused
            new LogseqAttachmentAdapter() // logseq images, pdfs, blocks, pages etc are handled here
        ]);
    }, []);

    const runtime = useLocalRuntime(LocalAISDKChatModelAdapter, {
        adapters: {
            history: historyAdapter,
            attachments: attachmentAdapter
        },
        maxSteps: 5,
        unstable_humanToolNames: toolRegistry.getHumanToolNames()
    });

    // Workaround: assistant-ui does not save messages with `requires-action` status. (local-thread-runtime-core.ts)
    // Subscribe to runEnd and persist the assistant message if it has pending human tools.
    useEffect(() => {
        return runtime.thread.unstable_on("runEnd", () => {
            const messages = runtime.thread.getState().messages;
            const lastMessage = messages[messages.length - 1];
            if (
                lastMessage?.role === "assistant" &&
                lastMessage.status?.type === "requires-action"
            ) {
                const messageRuntime = runtime.thread.getMessageById(lastMessage.id);
                const parentId = messageRuntime.getState().parentId;
                historyAdapter.append({
                    parentId,
                    message: lastMessage
                });
            }
        });
    }, [runtime, historyAdapter]);

    return runtime;
}
