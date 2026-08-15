import {ComposerPrimitive, useAuiState} from "@assistant-ui/react";
import {ArrowUpIcon, SquareIcon} from "lucide-react";
import type {FC} from "react";
import {ModelSelector} from "src/chat-app/components/ModelSelector";
import {useModelList} from "src/chat-app/hooks/useModelList";
import {usePersistedModelSelection} from "src/chat-app/hooks/usePersistedModelSelection";
import {useStopThread} from "src/chat-app/hooks/useStopThread";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "src/shadcn/radix-ui/button";

// import {ComposerAddAttachment} from "src/shadcn/assistant-ui/attachment";

/**
 * Changes:
 * (a) Removed ComposerAddAttachment button and added ModelSelector instead for flex positioning
 * (b) Delegates running and required-action termination to the project stop hook.
 * (c) Retains project-owned controls while matching current upstream sizing.
 * (d) Changed tooltop side to top.
 * (e) Added ModelSelector with Logseq-backed model and reasoning effort selection.
 */
export const ComposerAction: FC = () => {
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const lastMessage = useAuiState((state) => state.thread.messages.at(-1));
    const requiresActionState = lastMessage?.status?.type === "requires-action";
    const {stop, isStopping} = useStopThread();
    const models = useModelList();
    const {modelId, reasoningEffort, setModelId, setReasoningEffort} =
        usePersistedModelSelection(models);

    return (
        <div className="aui-composer-action-wrapper relative flex items-center justify-between">
            {/*<ComposerAddAttachment />*/}
            <ModelSelector
                models={models}
                value={modelId}
                onValueChange={setModelId}
                effort={reasoningEffort}
                onEffortChange={setReasoningEffort}
                size="sm"
                variant="ghost"
                align="start"
                className="max-w-[180px]"
            />
            {!isRunning && !requiresActionState && (
                <ComposerPrimitive.Send asChild>
                    <TooltipIconButton
                        tooltip="Send message"
                        side="top"
                        type="button"
                        variant="default"
                        size="icon"
                        className="aui-composer-send size-7 rounded-full"
                        aria-label="Send message">
                        <ArrowUpIcon className="aui-composer-send-icon size-4.5" />
                    </TooltipIconButton>
                </ComposerPrimitive.Send>
            )}
            {(isRunning || requiresActionState) && (
                <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="aui-composer-cancel size-7 rounded-full"
                    aria-label="Stop generating"
                    disabled={isStopping}
                    onClick={() => void stop()}>
                    <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
                </Button>
            )}
        </div>
    );
};
