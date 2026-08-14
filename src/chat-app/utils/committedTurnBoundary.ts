import type {ThreadMessage} from "@assistant-ui/react";
import {LogseqCommitChangesTool} from "src/chat-app/tools/impl/LogseqCommitChangesTool";

type MessagePart = ThreadMessage["content"][number];

export function isSuccessfulLogseqCommitToolPart(part: MessagePart): boolean {
    if (part.type !== "tool-call" || part.toolName !== LogseqCommitChangesTool.NAME) {
        return false;
    }

    const result = part.result;
    return (
        typeof result === "object" &&
        result !== null &&
        "success" in result &&
        result.success === true &&
        "outcome" in result &&
        result.outcome === "committed"
    );
}

export function getLatestCommittedTurnBoundary(messages: readonly ThreadMessage[]): number | null {
    let commitMessageIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.content.some(isSuccessfulLogseqCommitToolPart)) {
            commitMessageIndex = index;
            break;
        }
    }
    if (commitMessageIndex < 0) return null;

    for (let index = commitMessageIndex + 1; index < messages.length; index += 1) {
        if (messages[index]?.role === "user") return index;
    }
    return messages.length;
}

export function isMessageInCommittedHistory(
    messages: readonly ThreadMessage[],
    messageId: string
): boolean {
    const boundary = getLatestCommittedTurnBoundary(messages);
    if (boundary === null) return false;

    const messageIndex = messages.findIndex((message) => message.id === messageId);
    return messageIndex >= 0 && messageIndex < boundary;
}
