import {ComposerPrimitive, MessagePrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {type FC, useState} from "react";
import {useLogseqUncommittedChangesBranchGuard} from "src/chat-app/hooks/useLogseqUncommittedChangesBranchGuard";
import {Button} from "src/shadcn/radix-ui/button";

/**
 * Changes:
 * (a) Decompose ThreadMessage.
 * (b) Uses the same visible semantic background and border as the main composer.
 * (c) Guards Update because editing a message creates a new branch; uncommitted Logseq graph
 *     changes are reverted (after confirmation) before submitting the edit.
 */
export const EditComposer: FC = () => {
    const aui = useAui();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const guardBranchNavigation = useLogseqUncommittedChangesBranchGuard();
    const canSend = useAuiState((state) => state.composer.canSend);

    const handleUpdate = async () => {
        if (isSubmitting || !canSend) return;
        setIsSubmitting(true);
        try {
            const proceed = await guardBranchNavigation();
            if (!proceed) return;
            aui.message().composer().send();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MessagePrimitive.Root
            data-slot="aui_edit-composer-wrapper"
            className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]">
            <ComposerPrimitive.Root
                className="aui-edit-composer-root border-secondary-border bg-secondary-background ms-auto flex w-full max-w-[85%] flex-col rounded-(--composer-radius) border shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpdate();
                }}>
                <ComposerPrimitive.Input
                    className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
                    autoFocus
                />
                <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
                    <ComposerPrimitive.Cancel asChild>
                        <Button variant="ghost" size="sm" className="h-8 rounded-full px-3.5">
                            Cancel
                        </Button>
                    </ComposerPrimitive.Cancel>
                    <Button
                        type="submit"
                        size="sm"
                        className="h-8 rounded-full px-3.5"
                        disabled={isSubmitting || !canSend}>
                        Update
                    </Button>
                </div>
            </ComposerPrimitive.Root>
        </MessagePrimitive.Root>
    );
};
