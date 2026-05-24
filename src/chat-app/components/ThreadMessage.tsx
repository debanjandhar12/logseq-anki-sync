import {useAuiState} from "@assistant-ui/react";
import type {FC} from "react";
import {AssistantMessage} from "src/chat-app/components/AssistantMessage";
import {EditComposer} from "src/chat-app/components/EditComposer";
import {UserMessage} from "src/shadcn/assistant-ui/thread";

/**
 * Decomposed to modify AssistantMessage
 */
export const ThreadMessage: FC = () => {
    const role = useAuiState((s) => s.message.role);
    const isEditing = useAuiState((s) => s.message.composer.isEditing);

    if (isEditing) return <EditComposer />;
    if (role === "user") return <UserMessage />;
    return <AssistantMessage />;
};
