import {type GroupByContext, groupPartByType, MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {AssistantActionBar} from "src/chat-app/components/AssistantActionBar";
import {ToolFallback} from "src/chat-app/components/ToolFallback";
import {LogseqCommitChangesTool} from "src/chat-app/tools/impl/LogseqCommitChangesTool";
import {MarkdownText} from "src/shadcn/assistant-ui/markdown-text";
import {
    Reasoning,
    ReasoningContent,
    ReasoningRoot,
    ReasoningText,
    ReasoningTrigger
} from "src/shadcn/assistant-ui/reasoning";
import {BranchPicker, MessageError} from "src/shadcn/assistant-ui/thread";
import {
    ToolGroupContent,
    ToolGroupRoot,
    ToolGroupTrigger
} from "src/shadcn/assistant-ui/tool-group";
import {cn} from "src/shadcn/lib/utils";

/**
 * Changes:
 * (a) Removed tool grouping for CommitLogseqChanges tool.
 * (b) Changed the group reasoning component to display as collapse by default.
 * (c) Uses compact ghost variants for consistent reasoning and tool-call spacing.
 * (d) Preserves standalone tool UIs and renders data and indicator parts.
 */
export const AssistantMessage: FC = () => {
    const ACTION_BAR_PT = "pt-1.5";
    const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

    return (
        <MessagePrimitive.Root
            data-slot="aui_assistant-message-root"
            data-role="assistant"
            className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]">
            <div
                data-slot="aui_assistant-message-content"
                className="wrap-break-word px-2 text-foreground leading-relaxed">
                <MessagePrimitive.GroupedParts groupBy={groupMessagePart}>
                    {({part, children}) => {
                        switch (part.type) {
                            case "group-chainOfThought":
                                return <div data-slot="aui_chain-of-thought">{children}</div>;
                            case "group-reasoning": {
                                const running = part.status.type === "running";
                                return (
                                    <ReasoningRoot
                                        defaultOpen={false}
                                        variant="ghost"
                                        className="mb-0">
                                        <ReasoningTrigger active={running} />
                                        <ReasoningContent aria-busy={running}>
                                            <ReasoningText>{children}</ReasoningText>
                                        </ReasoningContent>
                                    </ReasoningRoot>
                                );
                            }
                            case "group-tool":
                                return (
                                    <ToolGroupRoot variant="ghost">
                                        <ToolGroupTrigger
                                            count={part.indices.length}
                                            active={part.status.type === "running"}
                                        />
                                        <ToolGroupContent>{children}</ToolGroupContent>
                                    </ToolGroupRoot>
                                );
                            case "text":
                                return <MarkdownText />;
                            case "reasoning":
                                return <Reasoning {...part} />;
                            case "tool-call":
                                return part.toolUI ?? <ToolFallback {...part} />;
                            case "data":
                                return part.dataRendererUI;
                            case "indicator":
                                return (
                                    <span
                                        data-slot="aui_assistant-message-indicator"
                                        className="animate-pulse font-sans"
                                        role="status"
                                        aria-label="Assistant is working">
                                        {"●"}
                                    </span>
                                );
                            default:
                                return null;
                        }
                    }}
                </MessagePrimitive.GroupedParts>
                <MessageError />
            </div>

            <div
                data-slot="aui_assistant-message-footer"
                className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}>
                <BranchPicker />
                <AssistantActionBar />
            </div>
        </MessagePrimitive.Root>
    );
};

const groupByType = groupPartByType<"group-chainOfThought" | "group-reasoning" | "group-tool">({
    reasoning: ["group-chainOfThought", "group-reasoning"],
    "tool-call": ["group-chainOfThought", "group-tool"],
    "standalone-tool-call": []
});

export const groupMessagePart = (
    part: Parameters<typeof groupByType>[0],
    context?: GroupByContext
) => {
    if (part.type === "tool-call" && part.toolName === LogseqCommitChangesTool.NAME) return [];
    return groupByType(part, context);
};