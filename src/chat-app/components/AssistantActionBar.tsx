import {ActionBarPrimitive, AuiIf, useAui, useAuiState} from "@assistant-ui/react";
import {CheckIcon, CopyIcon, RefreshCwIcon} from "lucide-react";
import {type FC, useState} from "react";
import {useLogseqAppliedChangesBranchGuard} from "src/chat-app/hooks/useLogseqAppliedChangesBranchGuard";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";

/**
 * This is the toolbar under assistant message.
 *
 * Changes:
 * (a) Disabled the ActionBarMore menu.
 * (b) Removed autohide="not-last" from ActionBarPrimitive.Root.
 * (c) Replaced ActionBarPrimitive.Reload with a guarded TooltipIconButton so applied uncommitted
 *     Logseq changes are reverted (after confirmation) before the assistant message is reloaded
 *     (which creates a new branch). Disabled parity mirrors useActionBarReload.
 */
export const AssistantActionBar: FC = () => {
    const aui = useAui();
    const [isReloading, setIsReloading] = useState(false);
    const guardBranchNavigation = useLogseqAppliedChangesBranchGuard();
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const isDisabled = useAuiState((state) => state.thread.isDisabled);
    const role = useAuiState((state) => state.message.role);
    const reloadDisabled = isReloading || isRunning || isDisabled || role !== "assistant";

    const handleReload = async () => {
        if (reloadDisabled) return;
        setIsReloading(true);
        try {
            const proceed = await guardBranchNavigation();
            if (!proceed) return;
            aui.message().reload();
        } finally {
            setIsReloading(false);
        }
    };

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
            <TooltipIconButton tooltip="Refresh" disabled={reloadDisabled} onClick={handleReload}>
                <RefreshCwIcon />
            </TooltipIconButton>
        </ActionBarPrimitive.Root>
    );
};
