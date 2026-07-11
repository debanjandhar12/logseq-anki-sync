import {memo} from "react";
import type {ToolCallMessagePartComponent, ToolCallMessagePartStatus} from "@assistant-ui/react";
import {
    ToolFallbackArgs,
    ToolFallbackContent, ToolFallbackError, ToolFallbackResult,
    ToolFallbackRoot,
} from "src/shadcn/assistant-ui/tool-fallback";
import {cn} from "src/shadcn/lib/utils";
import {CollapsibleTrigger} from "src/shadcn/radix-ui/collapsible";
import {AlertCircleIcon, CheckIcon, ChevronDownIcon, LoaderIcon, XCircleIcon} from "lucide-react";

/**
 * Changes:
 * (a) Decomposed to customize icon
 */
const ToolFallbackImpl: ToolCallMessagePartComponent = ({
                                                            toolName,
                                                            argsText,
                                                            result,
                                                            status,
                                                        }) => {
    const isCancelled =
        status?.type === "incomplete" && status.reason === "cancelled";

    return (
        <ToolFallbackRoot
            className={cn(isCancelled && "border-muted-foreground/30 bg-muted/30")}
        >
            <ToolFallbackTrigger toolName={toolName} status={status} />
            <ToolFallbackContent>
                <ToolFallbackError status={status} />
                <ToolFallbackArgs
                    argsText={argsText}
                    className={cn(isCancelled && "opacity-60")}
                />
                {!isCancelled && <ToolFallbackResult result={result} />}
            </ToolFallbackContent>
        </ToolFallbackRoot>
    );
};

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
    running: LoaderIcon,
    complete: CheckIcon,
    incomplete: XCircleIcon,
    "requires-action": AlertCircleIcon,
};

function ToolFallbackTrigger({
                                 toolName,
                                 status,
                                 className,
                                 ...props
                             }: React.ComponentProps<typeof CollapsibleTrigger> & {
    toolName: string;
    status?: ToolCallMessagePartStatus;
}) {
    const statusType = status?.type ?? "complete";
    const isRunning = statusType === "running";
    const isCancelled =
        status?.type === "incomplete" && status.reason === "cancelled";

    const Icon = statusIconMap[statusType];
    const label = isCancelled ? "Cancelled tool" : "Used tool";

    return (
        <CollapsibleTrigger
            data-slot="tool-fallback-trigger"
            className={cn(
                "aui-tool-fallback-trigger group/trigger flex w-full items-center gap-2 px-4 text-sm transition-colors",
                className,
            )}
            {...props}
        >
            <Icon
                data-slot="tool-fallback-trigger-icon"
                className={cn(
                    "aui-tool-fallback-trigger-icon size-4 shrink-0",
                    isCancelled && "text-muted-foreground",
                    isRunning && "animate-spin",
                )}
            />
            <span
                data-slot="tool-fallback-trigger-label"
                className={cn(
                    "aui-tool-fallback-trigger-label-wrapper relative inline-block grow text-start leading-none",
                    isCancelled && "text-muted-foreground line-through",
                )}
            >
        <span>
          {label}: <b>{toolName}</b>
        </span>
                {isRunning && (
                    <span
                        aria-hidden
                        data-slot="tool-fallback-trigger-shimmer"
                        className="aui-tool-fallback-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
                    >
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
                    "group-data-[state=open]/trigger:rotate-0",
                )}
            />
        </CollapsibleTrigger>
    );
}

export const ToolFallback = memo(
    ToolFallbackImpl,
) as unknown as ToolCallMessagePartComponent & {
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