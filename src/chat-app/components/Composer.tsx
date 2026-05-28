import {ComposerPrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {ComposerAction} from "src/chat-app/components/ComposerAction";
import {ComposerAttachments} from "src/chat-app/components/ComposerAttachments";

/**
 * Changes:
 * (a) Removed attachment dropzone
 * (b) Added logseq page / block mentions
 */
export const Composer: FC = () => {
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
                />
                <ComposerAction />
            </div>
        </ComposerPrimitive.Root>
    );
};
