import {useAssistantRuntime, useAuiState} from "@assistant-ui/react";
import {useState} from "react";
import {type StopThreadRunResult, stopThreadRun} from "src/chat-app/runtime/thread-run";
import {createLogger, LoggerCategory} from "src/logger";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useStopThread(): {
    stop: (options?: {
        errorMessage?: string;
        targetMessageId?: string;
    }) => Promise<StopThreadRunResult | undefined>;
    isStopping: boolean;
} {
    const assistantRuntime = useAssistantRuntime();
    const localThreadId = useAuiState((state) => state.threadListItem.id);
    const remoteThreadId = useAuiState((state) => state.threadListItem.remoteId);
    const threadId = remoteThreadId ?? localThreadId;
    const [isStopping, setIsStopping] = useState(false);

    return {
        isStopping,
        stop: async (options = {}) => {
            setIsStopping(true);
            try {
                const result = await stopThreadRun({
                    threadId,
                    runtime: assistantRuntime.threads.getById(threadId),
                    ...options
                });
                if (result.persistenceFailed) {
                    logger.error("Failed to persist terminated chat state");
                    try {
                        await logseq.UI.showMsg(
                            "The chat was stopped, but its terminated state could not be saved",
                            "error"
                        );
                    } catch (notificationError) {
                        logger.error("Failed to show chat termination error", notificationError);
                    }
                }
                return result;
            } catch (error) {
                logger.error("Failed to stop chat thread", error);
                try {
                    await logseq.UI.showMsg("Failed to save the terminated chat state", "error");
                } catch (notificationError) {
                    logger.error("Failed to show chat termination error", notificationError);
                }
                return undefined;
            } finally {
                setIsStopping(false);
            }
        }
    };
}
