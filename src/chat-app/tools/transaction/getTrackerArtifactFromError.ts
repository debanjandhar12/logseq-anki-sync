import type {ReadonlyJSONValue} from "assistant-stream/utils";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {LogseqReversibleTransactionExecutionError} from "src/core/logseq-reversible-transaction-tracker";

export function getTrackerArtifactFromError(error: unknown): ReadonlyJSONValue | undefined {
    return error instanceof LogseqReversibleTransactionExecutionError
        ? createLogseqReversibleTransactionTrackerArtifact(error.tracker)
        : undefined;
}
