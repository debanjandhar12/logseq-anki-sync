import {ActionBarPrimitive, AuiIf} from "@assistant-ui/react";
import {CheckIcon, CopyIcon, RefreshCwIcon} from "lucide-react";
import type {FC} from "react";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";

/**
 * This is the toolbar under assistant message.
 *
 * Changes:
 * (a) Disabled the ActionBarMore menu.
 * (b) Removed autohide="not-last" from ActionBarPrimitive.Root.
 */
export const AssistantActionBar: FC = () => {
    return (
        <ActionBarPrimitive.Root
            hideWhenRunning
            className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200">
            <ActionBarPrimitive.Copy asChild>
                <TooltipIconButton tooltip="Copy">
                    <AuiIf condition={(s) => s.message.isCopied}>
                        <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
                    </AuiIf>
                    <AuiIf condition={(s) => !s.message.isCopied}>
                        <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
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
