import type {ToolCallMessagePartComponent, ToolCallMessagePartStatus} from "@assistant-ui/react";
import {
    ChevronDownIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleXIcon,
    LoaderCircleIcon
} from "lucide-react";
import {memo} from "react";
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
 * (a) Decomposed to customize icon
 * (b) Uses the tool error flag and consistent circular Lucide status icons
 */
const ToolFallbackImpl: ToolCallMessagePartComponent = ({
    toolName,
    argsText,
    result,
    status,
    isError
}) => {
    const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";

    return (
        <ToolFallbackRoot className={cn(isCancelled && "border-muted-foreground/30 bg-muted/30")}>
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
                "aui-tool-fallback-trigger group/trigger flex w-full items-center gap-2 px-4 text-sm transition-colors",
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
                    "aui-tool-fallback-trigger-label-wrapper relative inline-block grow text-start leading-none",
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
            <ChevronDownIcon
                data-slot="tool-fallback-trigger-chevron"
                className={cn(
                    "aui-tool-fallback-trigger-chevron size-4 shrink-0",
                    "transition-transform duration-(--animation-duration) ease-out",
                    "group-data-[state=closed]/trigger:-rotate-90",
                    "group-data-[state=open]/trigger:rotate-0"
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
