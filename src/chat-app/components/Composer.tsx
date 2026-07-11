import {ComposerPrimitive, useAuiState} from "@assistant-ui/react";
import type {FC, KeyboardEvent} from "react";
import {AttachmentUI} from "src/chat-app/components/AttachmentUI";
import {ComposerAction} from "src/chat-app/components/ComposerAction";

/**
 * Changes:
 * (a) Removed attachment dropzone
 * (b) Added logseq page / block mentions
 * (c) Decomposed ComposerAttachments for using custom AttachmentUI
 * (d) Handles Shift+Enter explicitly because this does not work in Logseq sidebar as logseq intercepts it.
 *     ShadowDOM was unable to block this intercept.
 * (e) Hid the attachment scrollbar while preserving horizontal scrolling
 */
export const Composer: FC = () => {
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const requiresActionState = useAuiState(
        (state) => state.thread.messages.at(-1)?.status?.type === "requires-action"
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey && (isRunning || requiresActionState)) {
            event.preventDefault();
            return;
        }

        if (event.key !== "Enter" || !event.shiftKey) {
            return;
        }

        event.preventDefault();

        const textarea = event.currentTarget;
        const selectionStart = textarea.selectionStart ?? textarea.value.length;
        const selectionEnd = textarea.selectionEnd ?? textarea.value.length;
        const nextCursorPosition = selectionStart + 1;

        textarea.setRangeText("\n", selectionStart, selectionEnd, "end");
        textarea.dispatchEvent(new InputEvent("input", {bubbles: true, data: "\n"}));

        requestAnimationFrame(() => {
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
            textarea.scrollTop = textarea.scrollHeight;
        });
    };

    return (
        <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
            <div
                data-slot="aui_composer-shell"
                className="flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-background p-(--composer-padding) transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50">
                <ComposerAttachments />
                <ComposerPrimitive.Input
                    placeholder="Send a message..."
                    className="aui-composer-input max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-sm outline-none placeholder:text-muted-foreground/80"
                    rows={1}
                    autoFocus
                    aria-label="Message input"
                    onKeyDown={handleKeyDown}
                />
                <ComposerAction />
            </div>
        </ComposerPrimitive.Root>
    );
};

const ComposerAttachments: FC = () => {
    return (
        <div className="aui-composer-attachments flex w-full touch-pan-x flex-row items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] empty:hidden [&::-webkit-scrollbar]:hidden">
            <ComposerPrimitive.Attachments>{() => <AttachmentUI />}</ComposerPrimitive.Attachments>
        </div>
    );
};
