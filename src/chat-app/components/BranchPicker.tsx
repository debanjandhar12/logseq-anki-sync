import {BranchPickerPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react";
import {type FC, useRef, useState} from "react";
import {useLogseqAppliedChangesBranchGuard} from "src/chat-app/hooks/useLogseqAppliedChangesBranchGuard";
import {isMessageInCommittedHistory} from "src/chat-app/utils/committedTurnBoundary";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {cn} from "src/shadcn/lib/utils";

/**
 * Changes vs src/shadcn/assistant-ui/thread.tsx BranchPicker:
 * (a) Guards branch navigation so applied uncommitted Logseq changes are reverted (after confirm)
 *     before switching branches.
 * (b) Disables branch switching for messages in committed history and rechecks after the guard.
 */
export const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({className, ...rest}) => {
    const aui = useAui();
    const [isSwitching, setIsSwitching] = useState(false);
    const isSwitchingRef = useRef(false);
    const guardBranchNavigation = useLogseqAppliedChangesBranchGuard();
    const messages = useAuiState((state) => state.thread.messages);
    const messageId = useAuiState((state) => state.message.id);
    const branchNumber = useAuiState((state) => state.message.branchNumber);
    const branchCount = useAuiState((state) => state.message.branchCount);
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const canSwitchDuringRun = useAuiState(
        (state) => state.thread.capabilities.switchBranchDuringRun
    );
    const switchDisabled = isBranchSwitchDisabled({
        messages,
        messageId,
        isSwitching,
        isRunning,
        canSwitchDuringRun
    });

    const switchBranch = async (position: "previous" | "next") => {
        const targetMessageId = aui.message().getState().id;
        if (
            isSwitchingRef.current ||
            isCurrentBranchSwitchDisabled(aui, targetMessageId, position)
        ) {
            return;
        }

        isSwitchingRef.current = true;
        setIsSwitching(true);
        try {
            const proceed = await guardBranchNavigation();
            if (!proceed) return;
            if (isCurrentBranchSwitchDisabled(aui, targetMessageId, position)) return;
            aui.message().switchToBranch({position});
        } finally {
            isSwitchingRef.current = false;
            setIsSwitching(false);
        }
    };

    return (
        <BranchPickerPrimitive.Root
            hideWhenSingleBranch
            className={cn(
                "aui-branch-picker-root -ms-2 me-2 inline-flex items-center text-muted-foreground text-xs",
                className
            )}
            {...rest}>
            <TooltipIconButton
                tooltip="Previous"
                disabled={switchDisabled || branchNumber <= 1}
                onClick={() => void switchBranch("previous")}>
                <ChevronLeftIcon />
            </TooltipIconButton>
            <span className="aui-branch-picker-state font-medium">
                <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
            </span>
            <TooltipIconButton
                tooltip="Next"
                disabled={switchDisabled || branchNumber >= branchCount}
                onClick={() => void switchBranch("next")}>
                <ChevronRightIcon />
            </TooltipIconButton>
        </BranchPickerPrimitive.Root>
    );
};

interface BranchSwitchState {
    messages: Parameters<typeof isMessageInCommittedHistory>[0];
    messageId: string;
    isSwitching: boolean;
    isRunning: boolean;
    canSwitchDuringRun: boolean;
}

export function isBranchSwitchDisabled(state: BranchSwitchState): boolean {
    return (
        state.isSwitching ||
        (state.isRunning && !state.canSwitchDuringRun) ||
        isMessageInCommittedHistory(state.messages, state.messageId)
    );
}

function isCurrentBranchSwitchDisabled(
    aui: ReturnType<typeof useAui>,
    targetMessageId: string,
    position: "previous" | "next"
): boolean {
    const thread = aui.thread().getState();
    const message = aui.message().getState();
    return (
        message.id !== targetMessageId ||
        isBranchSwitchDisabled({
            messages: thread.messages,
            messageId: message.id,
            isSwitching: false,
            isRunning: thread.isRunning,
            canSwitchDuringRun: thread.capabilities.switchBranchDuringRun
        }) ||
        (position === "previous"
            ? message.branchNumber <= 1
            : message.branchNumber >= message.branchCount)
    );
}
