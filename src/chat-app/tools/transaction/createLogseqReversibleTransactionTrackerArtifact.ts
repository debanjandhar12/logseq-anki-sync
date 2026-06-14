import {
    type LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer,
    type SerializedLogseqReversibleTransactionTracker
} from "src/core/logseq-reversible-transaction-tracker";

export const LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE =
    "LogseqReversibleTransactionTracker";

export type LogseqReversibleTransactionTrackerArtifact = {
    type: typeof LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE;
    LogseqReversibleTransactionTracker: SerializedLogseqReversibleTransactionTracker;
};

export type ToolResponseArtifact = LogseqReversibleTransactionTrackerArtifact[];

export const createLogseqReversibleTransactionTrackerArtifact = (
    tracker: LogseqReversibleTransactionTracker
): ToolResponseArtifact => [
    {
        type: LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
        LogseqReversibleTransactionTracker:
            LogseqReversibleTransactionTrackerSerializer.serialize(tracker)
    }
];
