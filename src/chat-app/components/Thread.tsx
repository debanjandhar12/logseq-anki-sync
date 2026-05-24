import {AuiIf, ThreadPrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {Composer} from "src/chat-app/components/Composer";
import {ThreadMessage} from "src/chat-app/components/ThreadMessage";
import {ThreadScrollToBottom, ThreadWelcome} from "src/shadcn/assistant-ui/thread";

export const Thread: FC = () => {
    return (
        <ThreadPrimitive.Root
            className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
            style={{
                ["--thread-max-width" as string]: "44rem",
                ["--composer-radius" as string]: "24px",
                ["--composer-padding" as string]: "10px"
            }}>
            <ThreadPrimitive.Viewport
                turnAnchor="top"
                data-slot="aui_thread-viewport"
                className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth">
                <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
                    <AuiIf condition={(s) => s.thread.isEmpty}>
                        <ThreadWelcome />
                    </AuiIf>

                    <div
                        data-slot="aui_message-group"
                        className="mb-10 flex flex-col gap-y-8 empty:hidden">
                        <ThreadPrimitive.Messages>
                            {() => <ThreadMessage />}
                        </ThreadPrimitive.Messages>
                    </div>

                    <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) bg-background pb-4 md:pb-6">
                        <ThreadScrollToBottom />
                        <Composer />
                    </ThreadPrimitive.ViewportFooter>
                </div>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
};
