import {ActionBarMorePrimitive, ActionBarPrimitive, AuiIf} from "@assistant-ui/react";
import {CheckIcon, CopyIcon, DownloadIcon, MoreHorizontalIcon, RefreshCwIcon} from "lucide-react";
import {type FC, useContext} from "react";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {ShadowRootContext} from "src/ui/ShadowWrapper";

/**
 * This is the toolbar under assistant message.
 *
 * Changes:
 * (a) Disabled the ActionBarMore menu.
 */
export const AssistantActionBar: FC = () => {
    return (
        <ActionBarPrimitive.Root
            hideWhenRunning
            autohide="not-last"
            className="aui-assistant-action-bar-root col-start-3 row-start-2 -ms-1 flex gap-1 text-muted-foreground">
            <ActionBarPrimitive.Copy asChild>
                <TooltipIconButton tooltip="Copy">
                    <AuiIf condition={(s) => s.message.isCopied}>
                        <CheckIcon />
                    </AuiIf>
                    <AuiIf condition={(s) => !s.message.isCopied}>
                        <CopyIcon />
                    </AuiIf>
                </TooltipIconButton>
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload asChild>
                <TooltipIconButton tooltip="Refresh">
                    <RefreshCwIcon />
                </TooltipIconButton>
            </ActionBarPrimitive.Reload>
            {/*<ActionBarMorePrimitive.Root>*/}
            {/*    <ActionBarMorePrimitive.Trigger asChild>*/}
            {/*        <TooltipIconButton*/}
            {/*            tooltip="More"*/}
            {/*            className="data-[state=open]:bg-accent"*/}
            {/*        >*/}
            {/*            <MoreHorizontalIcon />*/}
            {/*        </TooltipIconButton>*/}
            {/*    </ActionBarMorePrimitive.Trigger>*/}
            {/*    <ActionBarMorePrimitive.Content*/}
            {/*        side="bottom"*/}
            {/*        align="start"*/}
            {/*        className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"*/}
            {/*    >*/}
            {/*        <ActionBarPrimitive.ExportMarkdown asChild>*/}
            {/*            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">*/}
            {/*                <DownloadIcon className="size-4" />*/}
            {/*                Export as Markdown*/}
            {/*            </ActionBarMorePrimitive.Item>*/}
            {/*        </ActionBarPrimitive.ExportMarkdown>*/}
            {/*    </ActionBarMorePrimitive.Content>*/}
            {/*</ActionBarMorePrimitive.Root>*/}
        </ActionBarPrimitive.Root>
    );
};
