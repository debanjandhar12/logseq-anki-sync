import {useChat} from "@ai-sdk/react";
import type {AssistantRuntime} from "@assistant-ui/react";
import {useAuiState} from "@assistant-ui/react";
import {useAISDKRuntime} from "@assistant-ui/react-ai-sdk";
import {useMemo} from "react";
import {LocalAISDKChatTransport} from "./LocalAISDKChatTransport";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";

/**
 * Hook that creates a thread-bound AssistantRuntime using AI SDK's useChat.
 * This hook binds the runtime to a specific thread and manages thread history.
 *
 * For non-new threads, it loads existing messages from the history adapter
 * and persists new messages as they arrive.
 *
 * @returns AssistantRuntime instance bound to the current thread
 */
export function useThreadBoundLocalAISDKChat(): AssistantRuntime {
    // Get thread context from assistant-ui state
    const threadId = useAuiState(
        (state) => state.threadListItem.remoteId ?? state.threadListItem.id
    );
    const threadStatus = useAuiState((state) => state.threadListItem.status);

    const historyAdapter = useMemo(
        () => new LocalThreadHistoryAdapter(threadId),
        [threadId]
    );

    // Create useChat instance bound to thread ID
    const chat = useChat({
        id: threadId,
        transport: new LocalAISDKChatTransport(),
        onError: (error) => logseq.UI.showMsg(error.message, "error")
    });

    // Wrap with useAISDKRuntime and attach history adapter
    const runtime = useAISDKRuntime(chat, {
        adapters: historyAdapter ? {history: historyAdapter} : undefined
    });

    return runtime;
}
