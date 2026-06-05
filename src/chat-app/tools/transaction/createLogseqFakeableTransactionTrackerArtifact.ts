import {
    type LogseqFakeableTransactionTracker,
    LogseqFakeableTransactionTrackerSerializer
} from "src/core/logseq-fakeable-transaction-tracker";
import type {SerializedLogseqFakeableTransactionTracker} from "src/core/logseq-fakeable-transaction-tracker/types";

export const LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE = "LogseqFakeableTransactionTracker";

export type LogseqFakeableTransactionTrackerArtifact = {
    type: typeof LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE;
    LogseqFakeableTransactionTracker: SerializedLogseqFakeableTransactionTracker;
};

export type ToolResponseArtifact = LogseqFakeableTransactionTrackerArtifact[];

export const createLogseqFakeableTransactionTrackerArtifact = (
    tracker: LogseqFakeableTransactionTracker
): ToolResponseArtifact => [
    {
        type: LOGSEQ_FAKEABLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
        LogseqFakeableTransactionTracker:
            LogseqFakeableTransactionTrackerSerializer.serialize(tracker)
    }
];
