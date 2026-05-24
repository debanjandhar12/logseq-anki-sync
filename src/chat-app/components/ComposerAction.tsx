import {AuiIf, ComposerPrimitive} from "@assistant-ui/react";
import {ArrowUpIcon, SquareIcon} from "lucide-react";
import type {FC} from "react";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {Button} from "src/shadcn/radix-ui/button";
// import {ComposerAddAttachment} from "src/shadcn/assistant-ui/attachment";

/**
 * Changes:
 * (a) Removed ComposerAddAttachment button and added empty div instead for flex positioning
 */
export const ComposerAction: FC = () => {
    return (
        <div className="aui-composer-action-wrapper relative flex items-center justify-between">
            {/*<ComposerAddAttachment />*/}
            <div></div>
            <AuiIf condition={(s) => !s.thread.isRunning}>
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
            <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild>
                    <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="aui-composer-cancel size-8 rounded-full"
                        aria-label="Stop generating">
                        <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
                    </Button>
                </ComposerPrimitive.Cancel>
            </AuiIf>
        </div>
    );
};
