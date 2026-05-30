import type {ThreadMessage} from "@assistant-ui/react";
import {LogseqFakeableTransactionTracker} from "src/core/logseq-fakeable-transaction-tracker";
import {
    LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
    type LogseqFakeableTransactionTrackerArtifact
} from "./createLogseqFakeableTransactionTrackerArtifact";

export const getLastLogseqFakeableTransactionTracker = (
    messages: readonly ThreadMessage[] = []
): LogseqFakeableTransactionTracker => {
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
        const message = messages[messageIndex];
        if (!message) continue;

        for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
            const part = message.content[partIndex];
            if (part?.type !== "tool-call") continue;

            const artifact = findLogseqFakeableTransactionTrackerArtifact(part.artifact);
            if (artifact) {
                return LogseqFakeableTransactionTracker.fromJSON(
                    artifact.LogseqFakeableTransactionTracker
                );
            }
        }
    }

    return new LogseqFakeableTransactionTracker();
};

function findLogseqFakeableTransactionTrackerArtifact(
    artifact: unknown
): LogseqFakeableTransactionTrackerArtifact | undefined {
    if (!Array.isArray(artifact)) return undefined;

    return artifact.find(isLogseqFakeableTransactionTrackerArtifactItem);
}

function isLogseqFakeableTransactionTrackerArtifactItem(
    artifact: unknown
): artifact is LogseqFakeableTransactionTrackerArtifact {
    if (typeof artifact !== "object" || artifact === null) return false;
    if (
        !("type" in artifact) ||
        artifact.type !== LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE
    ) {
        return false;
    }
    if (!("LogseqFakeableTransactionTracker" in artifact)) return false;

    const trackerJson = artifact.LogseqFakeableTransactionTracker;
    return (
        typeof trackerJson === "object" &&
        trackerJson !== null &&
        "commands" in trackerJson &&
        Array.isArray(trackerJson.commands)
    );
}
