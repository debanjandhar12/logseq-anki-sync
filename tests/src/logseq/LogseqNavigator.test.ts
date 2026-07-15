import {afterEach, describe, expect, it, vi} from "vitest";
import {LogseqNavigator} from "../../../src/logseq/LogseqNavigator";

describe("LogseqNavigator", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("goes to the supplied UUID", () => {
        const pushState = vi.fn();
        vi.stubGlobal("logseq", {App: {pushState}});

        LogseqNavigator.goToBlock("block-uuid");

        expect(pushState).toHaveBeenCalledWith("page", {name: "block-uuid"});
    });
});
