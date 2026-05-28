import {ThreadListPrimitive} from "@assistant-ui/react";
import {ArrowLeftIcon, HistoryIcon, PlusIcon, XIcon} from "lucide-react";
import {type FC, useContext} from "react";
import {ChatUIContext} from "../context/ChatUIContext";
import {TooltipIconButton} from "../../shadcn/assistant-ui/tooltip-icon-button";

interface ThreadTopToolBarProps {
    isHistoryVisible: boolean;
    onBackToThread: () => void;
    onShowHistory: () => void;
}

export const ThreadTopToolBar: FC<ThreadTopToolBarProps> = ({
    isHistoryVisible,
    onBackToThread,
    onShowHistory
}) => {
    const {onClose} = useContext(ChatUIContext);
    return (
        <div className="flex h-10 shrink-0 items-center justify-end border-b bg-background px-3">
            <div className="flex items-center gap-1">
                {isHistoryVisible ? (
                    <TooltipIconButton tooltip="Back to thread" onClick={onBackToThread}>
                        <ArrowLeftIcon className="size-4" />
                    </TooltipIconButton>
                ) : (
                    <TooltipIconButton tooltip="Thread history" onClick={onShowHistory}>
                        <HistoryIcon className="size-4" />
                    </TooltipIconButton>
                )}
                <ThreadListPrimitive.New asChild>
                    <TooltipIconButton tooltip="New thread" onClick={onBackToThread}>
                        <PlusIcon className="size-4" />
                    </TooltipIconButton>
                </ThreadListPrimitive.New>
                {onClose && (
                    <TooltipIconButton
                        tooltip="Close chat"
                        onClick={onClose}
                        className="hover:text-destructive">
                        <XIcon className="size-4" />
                    </TooltipIconButton>
                )}
            </div>
        </div>
    );
};
