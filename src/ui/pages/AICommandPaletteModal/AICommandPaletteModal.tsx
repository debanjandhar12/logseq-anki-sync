import React from "react";
import type {UserCommand} from "../../../core/user-commands";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList
} from "../../../shadcn/radix-ui/command";
import {Modal} from "../../modals/core/Modal";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";

export interface AICommandPaletteModalProps {
    commands: readonly UserCommand[];
    resolve: (value: UserCommand | null) => void;
    reject: (error: unknown) => void;
    modalContext?: {modalId: string | null};
}

export const AICommandPaletteModalComponent: React.FC<AICommandPaletteModalProps> = ({
    commands,
    resolve,
    modalContext
}) => {
    const selectionStartedRef = React.useRef(false);
    const {open, setOpen, handleCancel, returnResult} = useModal<UserCommand | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEnterKey: false,
        enableArrowKeyScroll: false, // Keep arrows in command palette.
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    const handleSelect = React.useCallback(
        (command: UserCommand) => {
            if (selectionStartedRef.current) return;
            selectionStartedRef.current = true;
            returnResult(command);
        },
        [returnResult]
    );

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={handleCancel}
            hasCloseButton={false}
            className="overflow-hidden p-0">
            <Command loop label="AI commands">
                <CommandInput
                    autoFocus
                    aria-label="Search AI commands"
                    placeholder="Search commands..."
                    className="h-[52px] text-xl"
                />
                <CommandList className="h-[65dvh] max-h-[65dvh] p-2">
                    <CommandEmpty>No matching AI commands.</CommandEmpty>
                    {commands.map((command) => (
                        <CommandItem
                            key={command.name}
                            value={command.name}
                            className="mx-0.5 cursor-pointer rounded-lg px-3 py-1.5 transition-colors duration-75 ease-in hover:bg-[var(--lx-gray-03,var(--ls-a-chosen-bg,var(--ls-tertiary-background-color,rgba(0,0,0,0.10))))] hover:text-[var(--lx-gray-12,var(--ls-primary-text-color))] hover:shadow-[inset_0_0_0_1px_var(--ls-border-color,var(--lx-gray-03,rgba(0,0,0,0.24)))] data-[selected=true]:bg-[var(--lx-gray-03,var(--ls-a-chosen-bg,var(--ls-tertiary-background-color,rgba(0,0,0,0.10))))] data-[selected=true]:text-[var(--lx-gray-12,var(--ls-primary-text-color))] data-[selected=true]:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.07),inset_0_0_0_1px_var(--lx-accent-03,#3b82f6)] data-[selected=true]:hover:shadow-[inset_0_0_0_1px_var(--ls-border-color,var(--lx-gray-09,rgba(0,0,0,0.32)))] dark:hover:shadow-none dark:data-[selected=true]:shadow-none"
                            onSelect={() => handleSelect(command)}>
                            {command.name}
                        </CommandItem>
                    ))}
                </CommandList>
            </Command>
        </Modal>
    );
};
