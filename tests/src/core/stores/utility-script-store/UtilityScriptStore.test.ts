import {beforeEach, describe, expect, test} from "vitest";
import {UtilityScriptStore} from "../../../../../src/core/stores/utility-script-store/UtilityScriptStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

describe("UtilityScriptStore", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("utility-script-store-test");
    });

    test("saves and reads validated JavaScript files", async () => {
        await UtilityScriptStore.saveScript("fetch-transcript.js", "script");

        await expect(UtilityScriptStore.getScript("fetch-transcript.js")).resolves.toBe("script");
        await expect(UtilityScriptStore.getScripts()).resolves.toEqual(["fetch-transcript.js"]);
    });

    test("rejects unsafe or unsupported names", () => {
        expect(() => UtilityScriptStore.saveScript("../script.js", "script")).toThrow();
        expect(() => UtilityScriptStore.saveScript("script.ts", "script")).toThrow();
    });
});
