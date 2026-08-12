import type {AssistantRuntime} from "@assistant-ui/react";
import {
    CompositeAttachmentAdapter,
    SimpleImageAttachmentAdapter,
    useAuiState,
    useLocalRuntime
} from "@assistant-ui/react";
import {useMemo} from "react";
import {CHAT_APP_AGENT_MAX_STEPS} from "../../constants";
import {ChatToolRegistry} from "../tools";
import {LocalAISDKChatModelAdapter} from "./LocalChatModelAdapter";
import {LocalThreadHistoryAdapter} from "./LocalThreadHistoryAdapter.js";
import {LogseqAttachmentAdapter} from "./LogseqAttachmentAdapter";
import {withRoundtripPersistence} from "./withRoundtripPersistence";

/**
 * Creates a thread-bound LocalRuntime backed by the AI SDK.
 */
export function useThreadBoundLocalAISDKChat(): AssistantRuntime {
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const toolRegistry = useMemo(() => ChatToolRegistry.build(), []);
    const humanToolNames = useMemo(() => toolRegistry.getHumanToolNames(), [toolRegistry]);

    const historyAdapter = useMemo(() => {
        return new LocalThreadHistoryAdapter(threadId, humanToolNames);
    }, [threadId, humanToolNames]);

    const attachmentAdapter = useMemo(() => {
        return new CompositeAttachmentAdapter([
            new SimpleImageAttachmentAdapter(), // currently unused
            new LogseqAttachmentAdapter() // logseq images, pdfs, blocks, pages etc are handled here
        ]);
    }, []);

    const chatModelAdapter = useMemo(
        () => withRoundtripPersistence(LocalAISDKChatModelAdapter, historyAdapter, threadId),
        [historyAdapter, threadId]
    );

    return useLocalRuntime(chatModelAdapter, {
        adapters: {
            history: historyAdapter,
            attachments: attachmentAdapter
        },
        maxSteps: CHAT_APP_AGENT_MAX_STEPS,
        unstable_humanToolNames: humanToolNames
    });
}
