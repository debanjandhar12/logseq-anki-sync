import {describe, expect, test} from "vitest";
import {hasUncommittedGraphMutations} from "../../../../src/chat-app/hooks/useLogseqUncommittedChangesBranchGuard";

describe("hasUncommittedGraphMutations", () => {
    test("is false without a tracker", () => {
        expect(hasUncommittedGraphMutations(null)).toBe(false);
        expect(hasUncommittedGraphMutations(undefined)).toBe(false);
    });

    test("delegates to applied graph mutation state", () => {
        expect(hasUncommittedGraphMutations({hasAppliedGraphMutations: () => true})).toBe(true);
        expect(hasUncommittedGraphMutations({hasAppliedGraphMutations: () => false})).toBe(false);
    });
});
