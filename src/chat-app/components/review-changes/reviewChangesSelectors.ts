import type {ThreadMessage} from "@assistant-ui/react";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";

export interface ReviewChangesSummary {
    commandCount: number;
    changedPageCount: number;
}

export type ReviewChangesLifecycleLabel =
    | "Applied uncommitted changes"
    | "Not applied uncommitted changes";

const EMPTY_REVIEW_CHANGES_SUMMARY: ReviewChangesSummary = {
    commandCount: 0,
    changedPageCount: 0
};

export function getReviewChangesSummary(messages: readonly ThreadMessage[]): ReviewChangesSummary {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker) return EMPTY_REVIEW_CHANGES_SUMMARY;

    const commandCount = locatedTracker.tracker.getGraphMutationCommandCount();
    if (commandCount === 0) return EMPTY_REVIEW_CHANGES_SUMMARY;

    return {
        commandCount,
        changedPageCount: locatedTracker.tracker.getChangedPages().length
    };
}

export function getReviewChangesLifecycleLabel(
    messages: readonly ThreadMessage[]
): ReviewChangesLifecycleLabel | null {
    const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
    if (!locatedTracker || locatedTracker.tracker.getGraphMutationCommandCount() === 0) {
        return null;
    }

    return locatedTracker.tracker.hasAppliedGraphMutations()
        ? "Applied uncommitted changes"
        : "Not applied uncommitted changes";
}
