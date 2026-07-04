import {afterEach, describe, expect, it, vi} from "vitest";
import {TextSearchCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/TextSearchCommand";
import {LogseqAppInfoFetcher} from "../../../../../src/logseq/LogseqAppInfoFetcher";
import {WindowParentBridge} from "../../../../../src/logseq/WindowParentBridge";

describe("TextSearchCommand", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("Searches text through the parent Logseq API.", async () => {
        const searchResult = [{uuid: "block-uuid"}];
        const search = vi.fn().mockResolvedValue(searchResult);
        vi.spyOn(LogseqAppInfoFetcher, "checkHostAccess").mockReturnValue(true);
        vi.spyOn(WindowParentBridge, "getLogseqObject").mockReturnValue({api: {search}});

        const command = new TextSearchCommand({searchString: "needle"});

        await expect(command.execute()).resolves.toBe(searchResult);
        expect(search).toHaveBeenCalledWith("needle");
    });

    it("Throws when parent window access is unavailable.", async () => {
        vi.spyOn(LogseqAppInfoFetcher, "checkHostAccess").mockReturnValue(false);

        const command = new TextSearchCommand({searchString: "needle"});

        await expect(command.execute()).rejects.toThrow(
            "Window.parent access is required to call logseq.api.search. Plugin API does not have this method."
        );
    });

    it("Revert is a no-op.", async () => {
        const command = new TextSearchCommand({searchString: "needle"});

        await expect(command.revert()).resolves.toBeUndefined();
    });
});
