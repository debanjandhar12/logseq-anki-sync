import {useChat} from "@ai-sdk/react";
import type {AssistantRuntime} from "@assistant-ui/react";
import {useAuiState} from "@assistant-ui/react";
import {useAISDKRuntime} from "@assistant-ui/react-ai-sdk";
import {useEffect, useMemo} from "react";
import {LocalAISDKChatTransport} from "./LocalAISDKChatTransport";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";
import {createLogger, LoggerCategory} from "src/logger";

const logger = createLogger(LoggerCategory.CHAT_UI);

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

    // Create history adapter for non-new threads
    const historyAdapter = useMemo(
        () => (threadStatus === "new" ? undefined : new LocalThreadHistoryAdapter(threadId)),
        [threadId, threadStatus]
    );

    // Create useChat instance bound to thread ID
    const chat = useChat({
        id: threadId,
        transport: new LocalAISDKChatTransport(),
        onError: (error) => logseq.UI.showMsg(error.message, "error")
    });

    // WORKAROUND for assistant-ui useExternalHistory bug:
    // useExternalHistory uses a loadedRef that is set to true on the first mount
    // (the default "new" thread which has no remoteId). When switching to an
    // existing thread, loadedRef is never reset, so history loading is permanently
    // skipped. We bypass this by manually loading history via ThreadStore.
    useEffect(() => {
        if (threadStatus === "new") return;
        let active = true;

        async function loadHistory() {
            try {
                const threadData = await ThreadStore.loadThread(threadId);
                if (!active) return;

                if (threadData?.exportedMessageRepository?.messages?.length) {
                    const loadedMessages = threadData.exportedMessageRepository.messages.map(
                        (item) => item.message as any
                    );
                    chat.setMessages(loadedMessages);
                }
            } catch (err) {
                logger.error("[useThreadBoundLocalAISDKChat] Failed to load history:", err);
            }
        }

        loadHistory();

        return () => {
            active = false;
        };
    }, [threadId, threadStatus, chat.setMessages]);

    // Wrap with useAISDKRuntime and attach history adapter
    const runtime = useAISDKRuntime(chat, {
        adapters: historyAdapter ? {history: historyAdapter} : undefined
    });

    return runtime;
}
