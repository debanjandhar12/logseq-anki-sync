import type {ThreadMessage} from "@assistant-ui/react";
import {
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "src/core/logseq-reversible-transaction-tracker";
import {
    LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
    type LogseqReversibleTransactionTrackerArtifact
} from "./createLogseqReversibleTransactionTrackerArtifact";

export const getLastLogseqReversibleTransactionTracker = (
    messages: readonly ThreadMessage[] = []
): LogseqReversibleTransactionTracker => {
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
        const message = messages[messageIndex];
        if (!message) continue;

        for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
            const part = message.content[partIndex];
            if (part?.type !== "tool-call") continue;

            const artifact = findLogseqReversibleTransactionTrackerArtifact(part.artifact);
            if (artifact) {
                return LogseqReversibleTransactionTrackerSerializer.deserialize(
                    artifact.LogseqReversibleTransactionTracker
                );
            }
        }
    }

    return new LogseqReversibleTransactionTracker();
};

function findLogseqReversibleTransactionTrackerArtifact(
    artifact: unknown
): LogseqReversibleTransactionTrackerArtifact | undefined {
    if (!Array.isArray(artifact)) return undefined;

    return artifact.find(isLogseqReversibleTransactionTrackerArtifactItem);
}

function isLogseqReversibleTransactionTrackerArtifactItem(
    artifact: unknown
): artifact is LogseqReversibleTransactionTrackerArtifact {
    if (typeof artifact !== "object" || artifact === null) return false;
    if (
        !("type" in artifact) ||
        artifact.type !== LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE
    ) {
        return false;
    }
    if (!("LogseqReversibleTransactionTracker" in artifact)) return false;

    const trackerJson = artifact.LogseqReversibleTransactionTracker;
    return (
        typeof trackerJson === "object" &&
        trackerJson !== null &&
        "commands" in trackerJson &&
        Array.isArray(trackerJson.commands)
    );
}
