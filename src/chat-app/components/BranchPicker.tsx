import {BranchPickerPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react";
import {type FC, useState} from "react";
import {useLogseqReversibleTransactionLifecycleContext} from "src/chat-app/context/LogseqReversibleTransactionLifecycleContext";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";
import {cn} from "src/shadcn/lib/utils";

export const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({className, ...rest}) => {
    const aui = useAui();
    const [isSwitching, setIsSwitching] = useState(false);
    const {cleanupBeforeNavigation} = useLogseqReversibleTransactionLifecycleContext();
    const branchNumber = useAuiState((state) => state.message.branchNumber);
    const branchCount = useAuiState((state) => state.message.branchCount);
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const canSwitchDuringRun = useAuiState(
        (state) => state.thread.capabilities.switchBranchDuringRun
    );
    const switchDisabled = isSwitching || (isRunning && !canSwitchDuringRun);

    const switchBranch = async (position: "previous" | "next") => {
        setIsSwitching(true);
        try {
            await cleanupBeforeNavigation();
            aui.message().switchToBranch({position});
        } finally {
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
