import type {ReadonlyJSONObject, ReadonlyJSONValue} from "assistant-stream/utils";
import {
    type LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "src/core/logseq-reversible-transaction-tracker";

export const LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE =
    "LogseqReversibleTransactionTracker";

export type LogseqReversibleTransactionTrackerArtifact = ReadonlyJSONObject & {
    type: typeof LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE;
    LogseqReversibleTransactionTracker: ReadonlyJSONValue;
};

export type ToolResponseArtifact = ReadonlyJSONObject & {
    [LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE]: LogseqReversibleTransactionTrackerArtifact;
};

export const createLogseqReversibleTransactionTrackerArtifact = (
    tracker: LogseqReversibleTransactionTracker
): ToolResponseArtifact => ({
    [LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE]: {
        type: LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
        LogseqReversibleTransactionTracker: LogseqReversibleTransactionTrackerSerializer.serialize(
            tracker
        ) as ReadonlyJSONValue
    }
});
