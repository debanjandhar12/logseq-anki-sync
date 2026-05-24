import {ComposerPrimitive, MessagePrimitive} from "@assistant-ui/react";
import type {FC} from "react";
import {Button} from "src/shadcn/radix-ui/button";

/**
 * Changes:
 * TBU
 */
export const EditComposer: FC = () => {
    return (
        <MessagePrimitive.Root data-slot="aui_edit-composer-wrapper" className="flex flex-col px-2">
            <ComposerPrimitive.Root className="aui-edit-composer-root ms-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
                <ComposerPrimitive.Input
                    className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
                    autoFocus
                />
                <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
                    <ComposerPrimitive.Cancel asChild>
                        <Button variant="ghost" size="sm">
                            Cancel
                        </Button>
                    </ComposerPrimitive.Cancel>
                    <ComposerPrimitive.Send asChild>
                        <Button size="sm">Update</Button>
                    </ComposerPrimitive.Send>
                </div>
            </ComposerPrimitive.Root>
        </MessagePrimitive.Root>
    );
};
