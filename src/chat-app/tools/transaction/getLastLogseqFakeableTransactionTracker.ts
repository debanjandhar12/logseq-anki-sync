import type {ThreadMessage} from "@assistant-ui/react";
import {LogseqFakeableTransactionTracker} from "src/core/logseq-fakeable-transaction-tracker";

const LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE = "logseq-fakeable-transaction-tracker";

type LogseqFakeableTransactionTrackerArtifact = {
    type: typeof LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE;
    tracker: LogseqFakeableTransactionTracker;
};

export const createLogseqFakeableTransactionTrackerArtifact = (
    tracker: LogseqFakeableTransactionTracker
): LogseqFakeableTransactionTrackerArtifact => ({
    type: LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
    tracker
});

export const getLastLogseqFakeableTransactionTracker = (
    messages: readonly ThreadMessage[] = []
): LogseqFakeableTransactionTracker => {
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
        const message = messages[messageIndex];
        if (!message) continue;

        for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
            const part = message.content[partIndex];
            if (part?.type !== "tool-call") continue;

            const artifact = part.artifact;
            if (isLogseqFakeableTransactionTrackerArtifact(artifact)) {
                return artifact.tracker;
            }
        }
    }

    return new LogseqFakeableTransactionTracker();
};

function isLogseqFakeableTransactionTrackerArtifact(
    artifact: unknown
): artifact is LogseqFakeableTransactionTrackerArtifact {
    return (
        typeof artifact === "object" &&
        artifact !== null &&
        "type" in artifact &&
        artifact.type === LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE &&
        "tracker" in artifact &&
        artifact.tracker instanceof LogseqFakeableTransactionTracker
    );
}
