import {type AssistantState, AuiIf, ThreadPrimitive, useAuiState} from "@assistant-ui/react";
import type {FC} from "react";
import {Composer} from "src/chat-app/components/Composer";
import {ThreadMessage} from "src/chat-app/components/ThreadMessage";
import {
    ThreadScrollToBottom,
    ThreadSuggestions,
    ThreadWelcome
} from "src/shadcn/assistant-ui/thread";
import {cn} from "src/shadcn/lib/utils";

const isNewChatView = (state: AssistantState) =>
    state.thread.messages.length === 0 && (!state.thread.isLoading || state.threads.isLoading);

/**
 * Changes:
 * (a) Uses project-owned message and composer components.
 * (b) Defines composer sizing here while Composer owns its semantic colors and border.
 */
export const Thread: FC = () => {
    const isEmpty = useAuiState(isNewChatView);

    return (
        <ThreadPrimitive.Root
            className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
            style={{
                ["--thread-max-width" as string]: "44rem",
                ["--composer-radius" as string]: "24px",
                ["--composer-padding" as string]: "10px"
            }}>
            <ThreadPrimitive.Viewport
                turnAnchor="top"
                data-slot="aui_thread-viewport"
                className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth">
                <div
                    className={cn(
                        "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
                        isEmpty && "justify-center"
                    )}>
                    <AuiIf condition={isNewChatView}>
                        <ThreadWelcome />
                    </AuiIf>

                    <div
                        data-slot="aui_message-group"
                        className="mb-14 flex flex-col gap-y-6 empty:hidden">
                        <ThreadPrimitive.Messages>
                            {() => <ThreadMessage />}
                        </ThreadPrimitive.Messages>
                    </div>

                    <ThreadPrimitive.ViewportFooter
                        className={cn(
                            "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
                            !isEmpty && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)"
                        )}>
                        <ThreadScrollToBottom />
                        <Composer />
                        <AuiIf
                            condition={(state) => isNewChatView(state) && state.composer.isEmpty}>
                            <ThreadSuggestions />
                        </AuiIf>
                    </ThreadPrimitive.ViewportFooter>
                </div>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
};
