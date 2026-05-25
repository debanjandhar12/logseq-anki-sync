import type {AssistantRuntime} from "@assistant-ui/react";
import {useAuiState, useLocalRuntime} from "@assistant-ui/react";
import {useMemo} from "react";
import {LocalAISDKChatModelAdapter} from "./LocalAISDKChatModelAdapter";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";

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

    return useLocalRuntime(LocalAISDKChatModelAdapter, {
        adapters: {
            history: historyAdapter
        }
    });
}
