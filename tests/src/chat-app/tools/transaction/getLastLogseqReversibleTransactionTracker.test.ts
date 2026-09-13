import {describe, expect, test} from "vitest";
import {
    findLastLogseqReversibleTransactionTracker,
    getLastLogseqReversibleTransactionTracker
} from "../../../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";

describe("findLastLogseqReversibleTransactionTracker", () => {
    test("keeps the tracker-only fallback for callers without artifacts", () => {
        expect(findLastLogseqReversibleTransactionTracker([])).toBeNull();
        expect(getLastLogseqReversibleTransactionTracker([]).getCommands()).toEqual([]);
    });
});
