import {AuiIf, ComposerPrimitive, useAuiState} from "@assistant-ui/react";
import {ArrowUpIcon, SquareIcon} from "lucide-react";
import type {FC} from "react";
import {ModelSelector} from "src/chat-app/components/ModelSelector";
import {useModelList} from "src/chat-app/hooks/useModelList";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "src/shadcn/radix-ui/button";
// import {ComposerAddAttachment} from "src/shadcn/assistant-ui/attachment";

/**
 * Changes:
 * (a) Removed ComposerAddAttachment button and added ModelSelector instead for flex positioning
 * (b) Shows a disabled cancel button while the assistant is waiting for a required user action
 * (c) Retains project-owned controls while matching current upstream sizing.
 * (d) Changed tooltop side to top.
 * (e) Added ModelSelector for model and reasoning effort selection.
 */
export const ComposerAction: FC = () => {
    const requiresActionState = useAuiState(
        (state) => state.thread.messages.at(-1)?.status?.type === "requires-action"
    );
    const models = useModelList();

    return (
        <div className="aui-composer-action-wrapper relative flex items-center justify-between">
            {/*<ComposerAddAttachment />*/}
            <ModelSelector
                models={models}
                defaultValue={models[0]?.id}
                defaultEffort="medium"
                size="sm"
                variant="ghost"
                align="start"
                className="max-w-[180px]"
            />
            <AuiIf condition={(state) => !state.thread.isRunning && !requiresActionState}>
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
            </AuiIf>
            <AuiIf condition={(state) => state.thread.isRunning || requiresActionState}>
                <ComposerPrimitive.Cancel asChild>
                    <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="aui-composer-cancel size-7 rounded-full"
                        aria-label="Stop generating"
                        disabled={requiresActionState}>
                        <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
                    </Button>
                </ComposerPrimitive.Cancel>
            </AuiIf>
        </div>
    );
};
