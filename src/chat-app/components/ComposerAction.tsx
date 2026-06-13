import {AuiIf, ComposerPrimitive, useAuiState} from "@assistant-ui/react";
import {ArrowUpIcon, SquareIcon} from "lucide-react";
import type {FC} from "react";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "src/shadcn/radix-ui/button";
// import {ComposerAddAttachment} from "src/shadcn/assistant-ui/attachment";

/**
 * Changes:
 * (a) Removed ComposerAddAttachment button and added empty div instead for flex positioning
 * (b) Shows a disabled cancel button while the assistant is waiting for a required user action
 */
export const ComposerAction: FC = () => {
    const requiresActionState = useAuiState(
        (state) => state.thread.messages.at(-1)?.status?.type === "requires-action"
    );

    return (
        <div className="aui-composer-action-wrapper relative flex items-center justify-between">
            {/*<ComposerAddAttachment />*/}
            <div></div>
            <AuiIf condition={(state) => !state.thread.isRunning && !requiresActionState}>
                <ComposerPrimitive.Send asChild>
                    <TooltipIconButton
                        tooltip="Send message"
                        side="bottom"
                        type="button"
                        variant="default"
                        size="icon"
                        className="aui-composer-send size-8 rounded-full"
                        aria-label="Send message">
                        <ArrowUpIcon className="aui-composer-send-icon size-4" />
                    </TooltipIconButton>
                </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(state) => state.thread.isRunning || requiresActionState}>
                <ComposerPrimitive.Cancel asChild>
                    <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="aui-composer-cancel size-8 rounded-full"
                        aria-label="Stop generating"
                        disabled={requiresActionState}>
                        <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
                    </Button>
                </ComposerPrimitive.Cancel>
            </AuiIf>
        </div>
    );
};
