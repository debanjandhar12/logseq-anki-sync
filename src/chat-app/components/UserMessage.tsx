import {MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {AttachmentUI} from "src/chat-app/components/AttachmentUI";
import {BranchPicker, UserActionBar} from "src/shadcn/assistant-ui/thread";

/**
 * Changes:
 * (a) Decomposed to modify UserMessageAttachments and use custom AttachmentUI
 * (b) Preserves the Logseq attachment pill layout.
 */
export const UserMessage: FC = () => {
    return (
        <MessagePrimitive.Root
            data-slot="aui_user-message-root"
            className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
            data-role="user">
            <UserMessageAttachments />

            <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
                <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
                    <MessagePrimitive.Parts />
                </div>
                <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
                    <UserActionBar />
                </div>
            </div>

            <BranchPicker
                data-slot="aui_user-branch-picker"
                className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
            />
        </MessagePrimitive.Root>
    );
};

const UserMessageAttachments: FC = () => {
    return (
        <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
            <MessagePrimitive.Attachments>{() => <AttachmentUI />}</MessagePrimitive.Attachments>
        </div>
    );
};
