import {describe, expect, test} from "vitest";
import {hasAppliedChanges} from "../../../../src/chat-app/hooks/useLogseqAppliedChangesBranchGuard";

describe("hasAppliedChanges", () => {
    test("is false without a tracker", () => {
        expect(hasAppliedChanges(null)).toBe(false);
        expect(hasAppliedChanges(undefined)).toBe(false);
    });

    test("delegates to applied graph mutation state", () => {
        expect(hasAppliedChanges({hasAppliedGraphMutations: () => true})).toBe(true);
        expect(hasAppliedChanges({hasAppliedGraphMutations: () => false})).toBe(false);
    });

    test("does not treat retained but unapplied review changes as applied", () => {
        const tracker = {hasAppliedGraphMutations: () => false};

        expect(hasAppliedChanges(tracker)).toBe(false);
    });
});
