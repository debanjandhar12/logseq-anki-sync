import {afterEach, describe, expect, test, vi} from "vitest";
import type {UnstructuredParseData} from "../../../../../src/core/stores/unstructured-parse-store/types";
import {UnstructuredParseStore} from "../../../../../src/core/stores/unstructured-parse-store/UnstructuredParseStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";

describe("UnstructuredParseStore", () => {
    afterEach(() => vi.restoreAllMocks());

    test("saves and loads a parse by page hash", async () => {
        const data: UnstructuredParseData = {
            version: 1,
            elements: [{type: "Title", text: "Cached title"}],
            content: "Cached title"
        };
        vi.spyOn(LogseqPluginStorageManager, "saveFile").mockResolvedValue(undefined);
        vi.spyOn(LogseqPluginStorageManager, "getFileContent").mockResolvedValue(
            JSON.stringify(data)
        );

        await UnstructuredParseStore.save("page-hash", data);
        await expect(UnstructuredParseStore.get("page-hash")).resolves.toEqual(data);

        expect(LogseqPluginStorageManager.saveFile).toHaveBeenCalledWith(
            "unstructured-parses",
            "page-hash.json",
            JSON.stringify(data)
        );
        expect(LogseqPluginStorageManager.getFileContent).toHaveBeenCalledWith(
            "unstructured-parses",
            "page-hash.json"
        );
    });

    test("treats malformed cached data as a cache miss", async () => {
        vi.spyOn(LogseqPluginStorageManager, "getFileContent").mockResolvedValue(
            JSON.stringify({version: 1, elements: []})
        );

        await expect(UnstructuredParseStore.get("invalid-hash")).resolves.toBeNull();
    });

    test("treats missing storage entries as cache misses", async () => {
        vi.spyOn(LogseqPluginStorageManager, "getFileContent").mockRejectedValue(
            new Error("missing")
        );

        await expect(UnstructuredParseStore.get("missing-hash")).resolves.toBeNull();
    });
});
