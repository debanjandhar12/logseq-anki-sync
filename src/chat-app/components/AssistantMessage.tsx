import {getMcpAppFromToolPart, MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {AssistantActionBar} from "src/chat-app/components/AssistantActionBar";
import {CommitLogseqChangesTool} from "src/chat-app/tools/impl/CommitLogseqChangesTool";
import {MarkdownText} from "src/shadcn/assistant-ui/markdown-text";
import {
    Reasoning,
    ReasoningContent,
    ReasoningRoot,
    ReasoningText,
    ReasoningTrigger
} from "src/shadcn/assistant-ui/reasoning";
import {BranchPicker, MessageError} from "src/shadcn/assistant-ui/thread";
import {ToolFallback} from "src/shadcn/assistant-ui/tool-fallback";
import {
    ToolGroupContent,
    ToolGroupRoot,
    ToolGroupTrigger
} from "src/shadcn/assistant-ui/tool-group";
import {cn} from "src/shadcn/lib/utils";

/**
 * Changes:
 * (a) Removed tool grouping for CommitLogseqChanges tool.
 */
export const AssistantMessage: FC = () => {
    // reserves space for action bar and compensates with `-mb` for consistent msg spacing
    // keeps hovered action bar from shifting layout (autohide doesn't support absolute positioning well)
    // for pt-[n] use -mb-[n + 6] & min-h-[n + 6] to preserve compensation
    const ACTION_BAR_PT = "pt-1.5";
    const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;

    return (
        <MessagePrimitive.Root
            data-slot="aui_assistant-message-root"
            data-role="assistant"
            className="fade-in slide-in-from-bottom-1 relative animate-in duration-150 [contain-intrinsic-size:auto_300px] [content-visibility:auto]">
            <div
                data-slot="aui_assistant-message-content"
                className="wrap-break-word px-2 text-foreground leading-relaxed">
                <MessagePrimitive.GroupedParts
                    groupBy={(part) => {
                        if (part.type === "reasoning")
                            return ["group-chainOfThought", "group-reasoning"];
                        if (part.type === "tool-call") {
                            if (getMcpAppFromToolPart(part)) return null;
                            if (part.toolName === CommitLogseqChangesTool.NAME) return null;
                            return ["group-chainOfThought", "group-tool"];
                        }
                        return null;
                    }}>
                    {({part, children}) => {
                        switch (part.type) {
                            case "group-chainOfThought":
                                return <div data-slot="aui_chain-of-thought">{children}</div>;
                            case "group-reasoning": {
                                const running = part.status.type === "running";
                                return (
                                    <ReasoningRoot defaultOpen={running}>
                                        <ReasoningTrigger active={running} />
                                        <ReasoningContent aria-busy={running}>
                                            <ReasoningText>{children}</ReasoningText>
                                        </ReasoningContent>
                                    </ReasoningRoot>
                                );
                            }
                            case "group-tool":
                                return (
                                    <ToolGroupRoot>
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
