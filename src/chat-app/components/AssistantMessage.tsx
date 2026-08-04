import {type GroupByContext, groupPartByType, MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {AssistantActionBar} from "src/chat-app/components/AssistantActionBar";
import {BranchPicker} from "src/chat-app/components/BranchPicker";
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
import {MessageError} from "src/shadcn/assistant-ui/thread";
import {cn} from "src/shadcn/lib/utils";

/**
 * Changes:
 * (a) Removed tool grouping for CommitLogseqChanges tool.
 * (b) Groups reasoning and tool calls in one collapsed chain-of-thought block.
 * (d) Preserves standalone tool UIs and renders data and indicator parts.
 * (e) Uses guarded branch navigation so applied uncommitted changes are reverted first.
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
                            case "group-chainOfThought": {
                                const active =
                                    part.status.type === "running" ||
                                    part.status.type === "requires-action";
                                return (
                                    <ReasoningRoot
                                        defaultOpen={false}
                                        streaming={active}
                                        variant="ghost"
                                        className="mb-0">
                                        <ReasoningTrigger active={active} />
                                        <ReasoningContent aria-busy={active}>
                                            <ReasoningText>{children}</ReasoningText>
                                        </ReasoningContent>
                                    </ReasoningRoot>
                                );
                            }
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

const groupByType = groupPartByType<"group-chainOfThought">({
    reasoning: ["group-chainOfThought"],
    "tool-call": ["group-chainOfThought"],
    "standalone-tool-call": []
});

export const groupMessagePart = (
    part: Parameters<typeof groupByType>[0],
    context?: GroupByContext
) => {
    if (part.type === "tool-call" && part.toolName === LogseqCommitChangesTool.NAME) return [];
    return groupByType(part, context);
};
