import {
    type ToolCallMessagePartComponent,
    type ToolCallMessagePartStatus,
    useToolCallElapsed
} from "@assistant-ui/react";
import {
    ChevronDownIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleXIcon,
    LoaderCircleIcon
} from "lucide-react";
import {memo, useEffect, useState} from "react";
import {
    ToolFallbackArgs,
    ToolFallbackContent,
    ToolFallbackError,
    ToolFallbackResult,
    ToolFallbackRoot
} from "src/shadcn/assistant-ui/tool-fallback";
import {cn} from "src/shadcn/lib/utils";
import {CollapsibleTrigger} from "src/shadcn/radix-ui/collapsible";

/**
 * Changes:
 * (a) Decomposed to customize Lucide icons
 * (b) Keeps required-action tools expanded without exposing unsupported generic approval controls
 */
const ToolFallbackImpl: ToolCallMessagePartComponent = ({
    toolName,
    argsText,
    result,
    status,
    isError
}) => {
    const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";
    const isRequiresAction = status?.type === "requires-action";
    const [open, setOpen] = useState(isRequiresAction);

    useEffect(() => {
        if (isRequiresAction) setOpen(true);
    }, [isRequiresAction]);

    return (
        <ToolFallbackRoot
            open={open}
            onOpenChange={setOpen}
            className={cn(isCancelled && "text-muted-foreground")}>
            <ToolFallbackTrigger toolName={toolName} status={status} isError={isError} />
            <ToolFallbackContent>
                <ToolFallbackError status={status} />
                <ToolFallbackArgs argsText={argsText} className={cn(isCancelled && "opacity-60")} />
                {!isCancelled && <ToolFallbackResult result={result} />}
            </ToolFallbackContent>
        </ToolFallbackRoot>
    );
};

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
    running: LoaderCircleIcon,
    complete: CircleCheckIcon,
    incomplete: CircleXIcon,
    "requires-action": CircleAlertIcon
};

const formatToolDuration = (milliseconds: number) => {
    if (milliseconds < 1000) return "<1s";
    const seconds = milliseconds / 1000;
    if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

const ToolFallbackDuration = () => {
    const elapsedMilliseconds = useToolCallElapsed();
    if (elapsedMilliseconds === undefined) return null;

    return (
        <span className="aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums">
            {formatToolDuration(elapsedMilliseconds)}
        </span>
    );
};

function ToolFallbackTrigger({
    toolName,
    status,
    isError,
    className,
    ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
    toolName: string;
    status?: ToolCallMessagePartStatus;
    isError?: boolean;
}) {
    const statusType = status?.type ?? "complete";
    const isRunning = statusType === "running";
    const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";

    const Icon = isError ? CircleXIcon : statusIconMap[statusType];
    const statusLabel = isError ? "Tool failed" : isCancelled ? "Tool cancelled" : statusType;
    const label = isCancelled ? "Cancelled tool" : "Used tool";

    return (
        <CollapsibleTrigger
            data-slot="tool-fallback-trigger"
            className={cn(
                "aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
                className
            )}
            {...props}>
            <Icon
                aria-label={statusLabel}
                data-slot="tool-fallback-trigger-icon"
                className={cn(
                    "aui-tool-fallback-trigger-icon size-4 shrink-0",
                    isCancelled && "text-muted-foreground",
                    isRunning && "animate-spin"
                )}
            />
            <span
                data-slot="tool-fallback-trigger-label"
                className={cn(
                    "aui-tool-fallback-trigger-label-wrapper relative inline-block text-start leading-none",
                    isCancelled && "text-muted-foreground line-through"
                )}>
                <span>
                    {label}: <b>{toolName}</b>
                </span>
                {isRunning && (
                    <span
                        aria-hidden
                        data-slot="tool-fallback-trigger-shimmer"
                        className="aui-tool-fallback-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none">
                        {label}: <b>{toolName}</b>
                    </span>
                )}
            </span>
            <ToolFallbackDuration />
            <ChevronDownIcon
                data-slot="tool-fallback-trigger-chevron"
                className={cn(
                    "aui-tool-fallback-trigger-chevron size-4 shrink-0",
                    "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                    "-rotate-90",
                    "group-data-open/trigger:rotate-0",
                    "group-data-panel-open/trigger:rotate-0"
                )}
            />
        </CollapsibleTrigger>
    );
}

export const ToolFallback = memo(ToolFallbackImpl) as unknown as ToolCallMessagePartComponent & {
    Root: typeof ToolFallbackRoot;
    Trigger: typeof ToolFallbackTrigger;
    Content: typeof ToolFallbackContent;
    Args: typeof ToolFallbackArgs;
    Result: typeof ToolFallbackResult;
    Error: typeof ToolFallbackError;
};

ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;
