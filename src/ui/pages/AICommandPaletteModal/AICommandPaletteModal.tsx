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
        enableArrowKeyScroll: false,
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
            <Command loop label="AI commands" className="min-h-[280px]">
                <CommandInput
                    autoFocus
                    aria-label="Search AI commands"
                    placeholder="Search commands..."
                />
                <CommandList className="max-h-[360px] p-2">
                    <CommandEmpty>No matching AI commands.</CommandEmpty>
                    {commands.map((command) => (
                        <CommandItem
                            key={command.name}
                            value={command.name}
                            onSelect={() => handleSelect(command)}>
                            {command.name}
                        </CommandItem>
                    ))}
                </CommandList>
            </Command>
        </Modal>
    );
};
