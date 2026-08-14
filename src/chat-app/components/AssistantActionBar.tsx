import {ActionBarPrimitive, AuiIf, useAui, useAuiState} from "@assistant-ui/react";
import {CheckIcon, CopyIcon, RefreshCwIcon} from "lucide-react";
import {type FC, useRef, useState} from "react";
import {useLogseqAppliedChangesBranchGuard} from "src/chat-app/hooks/useLogseqAppliedChangesBranchGuard";
import {isMessageInCommittedHistory} from "src/chat-app/utils/committedTurnBoundary";
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
 * (d) Disables Refresh for messages in committed history and rechecks after asynchronous guards.
 */
export const AssistantActionBar: FC = () => {
    const aui = useAui();
    const [isReloading, setIsReloading] = useState(false);
    const isReloadingRef = useRef(false);
    const guardBranchNavigation = useLogseqAppliedChangesBranchGuard();
    const messages = useAuiState((state) => state.thread.messages);
    const messageId = useAuiState((state) => state.message.id);
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const isDisabled = useAuiState((state) => state.thread.isDisabled);
    const role = useAuiState((state) => state.message.role);
    const reloadDisabled = isAssistantReloadDisabled({
        messages,
        messageId,
        role,
        isReloading,
        isRunning,
        isDisabled
    });

    const handleReload = async () => {
        const targetMessageId = aui.message().getState().id;
        if (isReloadingRef.current || isCurrentReloadDisabled(aui, targetMessageId)) return;

        isReloadingRef.current = true;
        setIsReloading(true);
        try {
            const proceed = await guardBranchNavigation();
            if (!proceed) return;
            if (isCurrentReloadDisabled(aui, targetMessageId)) return;
            aui.message().reload();
        } finally {
            isReloadingRef.current = false;
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

interface AssistantReloadState {
    messages: Parameters<typeof isMessageInCommittedHistory>[0];
    messageId: string;
    role: string;
    isReloading: boolean;
    isRunning: boolean;
    isDisabled: boolean;
}

export function isAssistantReloadDisabled(state: AssistantReloadState): boolean {
    return (
        state.isReloading ||
        state.isRunning ||
        state.isDisabled ||
        state.role !== "assistant" ||
        isMessageInCommittedHistory(state.messages, state.messageId)
    );
}

function isCurrentReloadDisabled(aui: ReturnType<typeof useAui>, targetMessageId: string): boolean {
    const thread = aui.thread().getState();
    const message = aui.message().getState();
    return (
        message.id !== targetMessageId ||
        isAssistantReloadDisabled({
            messages: thread.messages,
            messageId: message.id,
            role: message.role,
            isReloading: false,
            isRunning: thread.isRunning,
            isDisabled: thread.isDisabled
        })
    );
}
