import {type ThreadMessage, useAuiState} from "@assistant-ui/react";
import {GitCommitIcon} from "lucide-react";
import type {FC} from "react";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {cn} from "src/shadcn/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "src/shadcn/radix-ui/tooltip";

interface PendingLogseqChangesDisplayProps {
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

export const getPendingLogseqChangesCommandCount = (messages: readonly ThreadMessage[]): number => {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker) return 0;
    if (locatedTracker.tracker.getChangedPages().length === 0) return 0;

    return locatedTracker.tracker.getCommands().length;
};

export const PendingLogseqChangesDisplay: FC<PendingLogseqChangesDisplayProps> = ({
    className,
    side = "bottom"
}) => {
    const pendingCommandCount = useAuiState((state) =>
        getPendingLogseqChangesCommandCount(state.thread.messages)
    );

    if (pendingCommandCount === 0) return null;

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex size-6 items-center justify-center rounded-md p-1 text-amber-500 transition-colors hover:bg-accent hover:text-amber-500",
                            className
                        )}
                        aria-label="Pending Logseq changes">
                        <GitCommitIcon className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    sideOffset={8}
                    className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md [&_span>svg]:hidden!">
                    <div className="grid min-w-40 gap-1.5 text-xs">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Pending commands</span>
                            <span className="font-mono tabular-nums">{pendingCommandCount}</span>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
