import "@logseq/libs";
import {beforeAll} from "vitest";
import {LogseqPluginStorageManager} from "../src/logseq/LogseqPluginStorageManager";
import {setupLogseqProxy} from "./helpers/setupLogseqProxy";

// Setup logseq proxy before all test cases run
setupLogseqProxy();

beforeAll(async () => {
    await LogseqPluginStorageManager.init();
});

// Check Logseq availability
try {
    // @ts-ignore
    const isDBGraphAPIResponse = await logseq.App.checkCurrentIsDbGraph();
    globalThis.isLogseqAvailable = typeof isDBGraphAPIResponse === "boolean";
    globalThis.isLogseqCurrentIsDBGraph =
        typeof isDBGraphAPIResponse === "boolean" ? isDBGraphAPIResponse : false;
} catch {
    globalThis.isLogseqAvailable = false;
    globalThis.isLogseqCurrentIsDBGraph = false;
    // biome-ignore lint/suspicious/noConsole: logger not present in test mode
    console.log("Logseq not available - some tests will be skipped");
}
