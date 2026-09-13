import {describe, expect, test} from "vitest";
import {hasAppliedChanges} from "../../../../src/chat-app/hooks/useLogseqAppliedChangesBranchGuard";

describe("hasAppliedChanges", () => {
    test("is false without a tracker", () => {
        expect(hasAppliedChanges(null)).toBe(false);
        expect(hasAppliedChanges(undefined)).toBe(false);
    });
});
