import {beforeAll} from "vitest";

// Worker/Pyodide tests use Node and do not require the browser-only Logseq client.
if (typeof window !== "undefined") {
    // @ts-ignore -- Vitest supports top-level await in setup files.
    await import("@logseq/libs");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {setupLogseqProxy} = await import("./helpers/logseq-api-proxy");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {LogseqHttpProxy} = await import("../src/logseq/LogseqHttpProxy");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {LogseqPluginStorageManager} = await import("../src/logseq/LogseqPluginStorageManager");

    // Setup logseq proxy before all test cases run
    setupLogseqProxy();

    beforeAll(async () => {
        await LogseqHttpProxy.init();
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
}
