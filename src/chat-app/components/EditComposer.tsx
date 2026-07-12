import {ComposerPrimitive, MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {Button} from "src/shadcn/radix-ui/button";

/**
 * Changes:
 * (a) Kept as a project-owned component for ThreadMessage decomposition.
 */
export const EditComposer: FC = () => {
    return (
        <MessagePrimitive.Root
            data-slot="aui_edit-composer-wrapper"
            className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]">
            <ComposerPrimitive.Root className="aui-edit-composer-root border-secondary-border bg-secondary-background ms-auto flex w-full max-w-[85%] flex-col rounded-(--composer-radius) border shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
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
                    <ComposerPrimitive.Send asChild>
                        <Button size="sm" className="h-8 rounded-full px-3.5">
                            Update
                        </Button>
                    </ComposerPrimitive.Send>
                </div>
            </ComposerPrimitive.Root>
        </MessagePrimitive.Root>
    );
};
