import {ComposerPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {type FC, type KeyboardEvent, useLayoutEffect, useRef} from "react";
import {AttachmentUI} from "src/chat-app/components/AttachmentUI";
import {ComposerAction} from "src/chat-app/components/ComposerAction";
import {useLogseqReversibleTransactionLifecycleContext} from "src/chat-app/context/LogseqReversibleTransactionLifecycleContext";

/**
 * Changes:
 * (a) Removed attachment dropzone
 * (b) Added logseq page / block mentions
 * (c) Decomposed ComposerAttachments for using custom AttachmentUI
 * (d) Handles Shift+Enter explicitly because this does not work in Logseq sidebar as logseq intercepts it.
 *     ShadowDOM was unable to block this intercept.
 * (e) Hid the attachment scrollbar while preserving horizontal scrolling
 * (f) Uses Logseq semantic background and border colors for visible contrast.
 * (g) Updates the controlled composer state for Shift+Enter so textarea autosizing stays in sync.
 * (h) Measures the real Shadow DOM textarea and remeasures when its layout width stabilizes.
 * (i) Displays the countdown until temporary Logseq changes are reverted.
 */
export const Composer: FC = () => {
    const api = useAui();
    const composerText = useAuiState((state) => state.composer.text);
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const requiresActionState = useAuiState(
        (state) => state.thread.messages.at(-1)?.status?.type === "requires-action"
    );
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const {hasTemporaryChanges, remainingSeconds} =
        useLogseqReversibleTransactionLifecycleContext();

    useLayoutEffect(() => {
        const textarea = inputRef.current;
        if (!textarea || textarea.value !== composerText) return;

        resizeComposerInput(textarea);
        const animationFrame = requestAnimationFrame(() => resizeComposerInput(textarea));
        return () => cancelAnimationFrame(animationFrame);
    }, [composerText]);

    useLayoutEffect(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        let measuredWidth = textarea.clientWidth;
        const resizeObserver = new ResizeObserver(() => {
            const currentWidth = textarea.clientWidth;
            if (currentWidth === measuredWidth) return;

            measuredWidth = currentWidth;
            resizeComposerInput(textarea);
        });
        resizeObserver.observe(textarea);

        return () => resizeObserver.disconnect();
    }, []);

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
        const nextText = `${textarea.value.slice(0, selectionStart)}\n${textarea.value.slice(selectionEnd)}`;

        api.composer().setText(nextText);

        requestAnimationFrame(() => {
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    };

    return (
        <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
            <div
                data-slot="aui_composer-shell"
                className="border-secondary-border bg-secondary-background focus-within:border-ring/75 focus-within:ring-ring/20 flex w-full flex-col gap-2 rounded-(--composer-radius) border p-(--composer-padding) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:ring-2 focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none">
                {hasTemporaryChanges && remainingSeconds !== null && (
                    <div
                        className="border-secondary-border bg-muted text-muted-foreground -mx-[var(--composer-padding)] -mt-[var(--composer-padding)] rounded-t-[calc(var(--composer-radius)-1px)] border-b px-4 py-2 text-xs"
                        role="status">
                        Reverting temporary changes in {remainingSeconds}s
                    </div>
                )}
                <ComposerAttachments />
                <ComposerPrimitive.Input
                    ref={inputRef}
                    render={<textarea />}
                    placeholder="Send a message..."
                    className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 h-8 max-h-32 w-full resize-none overflow-y-auto bg-transparent px-2.5 py-1 text-base outline-none"
                    rows={1}
                    autoFocus
                    enterKeyHint="send"
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

const resizeComposerInput = (textarea: HTMLTextAreaElement) => {
    if (textarea.clientWidth === 0) return;

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
};
