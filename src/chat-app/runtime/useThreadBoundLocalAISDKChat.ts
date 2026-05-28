import type {AssistantRuntime} from "@assistant-ui/react";
import {
    CompositeAttachmentAdapter,
    SimpleImageAttachmentAdapter,
    useAuiState,
    useLocalRuntime
} from "@assistant-ui/react";
import {useMemo} from "react";
import {LocalAISDKChatModelAdapter} from "./LocalAISDKChatModelAdapter";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";
import {LogseqBlockAttachmentAdapter} from "./LogseqBlockAttachmentAdapter";

/**
 * Creates a thread-bound LocalRuntime backed by the AI SDK.
 */
export function useThreadBoundLocalAISDKChat(): AssistantRuntime {
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;

    const historyAdapter = useMemo(() => {
        return new LocalThreadHistoryAdapter(threadId);
    }, [threadId]);

    const attachmentAdapter = useMemo(() => {
        return new CompositeAttachmentAdapter([
            new SimpleImageAttachmentAdapter(),
            new LogseqBlockAttachmentAdapter()
        ]);
    }, []);

    return useLocalRuntime(LocalAISDKChatModelAdapter, {
        adapters: {
            history: historyAdapter,
            attachments: attachmentAdapter
        }
    });
}
