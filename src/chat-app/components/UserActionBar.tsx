import {ActionBarPrimitive, useAui, useAuiState} from "@assistant-ui/react";
import {PencilIcon} from "lucide-react";
import type {FC} from "react";
import {isMessageInCommittedHistory} from "src/chat-app/utils/committedTurnBoundary";
import {TooltipIconButton} from "src/shadcn/assistant-ui/tooltip-icon-button";

/**
 * Changes vs src/shadcn/assistant-ui/thread.tsx UserActionBar:
 * (a) Disables Edit for messages in committed history.
 * (b) Uses an explicit handler so committed state is checked again immediately before editing.
 */
export const UserActionBar: FC = () => {
    const aui = useAui();
    const messages = useAuiState((state) => state.thread.messages);
    const messageId = useAuiState((state) => state.message.id);
    const role = useAuiState((state) => state.message.role);
    const isEditing = useAuiState((state) => state.message.composer.isEditing);
    const isRunning = useAuiState((state) => state.thread.isRunning);
    const isDisabled = useAuiState((state) => state.thread.isDisabled);
    const editDisabled = isUserEditDisabled({
        messages,
        messageId,
        role,
        isEditing,
        isRunning,
        isDisabled
    });

    const handleEdit = () => {
        const thread = aui.thread().getState();
        const message = aui.message().getState();
        const composer = aui.message().composer().getState();
        if (
            message.id !== messageId ||
            isUserEditDisabled({
                messages: thread.messages,
                messageId: message.id,
                role: message.role,
                isEditing: composer.isEditing,
                isRunning: thread.isRunning,
                isDisabled: thread.isDisabled
            })
        ) {
            return;
        }

        aui.message().composer().beginEdit();
    };

    return (
        <ActionBarPrimitive.Root
            hideWhenRunning
            autohide="not-last"
            className="aui-user-action-bar-root flex flex-col items-end">
            <TooltipIconButton
                tooltip="Edit"
                className="aui-user-action-edit"
                disabled={editDisabled}
                onClick={handleEdit}>
                <PencilIcon />
            </TooltipIconButton>
        </ActionBarPrimitive.Root>
    );
};

interface UserEditState {
    messages: Parameters<typeof isMessageInCommittedHistory>[0];
    messageId: string;
    role: string;
    isEditing: boolean;
    isRunning: boolean;
    isDisabled: boolean;
}

export function isUserEditDisabled(state: UserEditState): boolean {
    return (
        state.isEditing ||
        state.isRunning ||
        state.isDisabled ||
        state.role !== "user" ||
        isMessageInCommittedHistory(state.messages, state.messageId)
    );
}
