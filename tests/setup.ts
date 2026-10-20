import {beforeAll} from "vitest";

if (typeof window !== "undefined") {
    // @ts-ignore -- Vitest supports top-level await in setup files.
    await import("@logseq/libs");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {setupLogseqProxy} = await import("./helpers/logseq-api-proxy");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {LogseqHttpProxy} = await import("../src/logseq/LogseqHttpProxy");
    // @ts-ignore -- Vitest supports top-level await in setup files.
    const {WindowParentBridge} = await import("../src/logseq/WindowParentBridge");

    // Setup logseq proxy before all test cases run
    setupLogseqProxy();

    beforeAll(async () => {
        await LogseqHttpProxy.init();
        WindowParentBridge.init(window);
    });

    // Check Logseq availability
    try {
        // @ts-ignore
        const isDBGraphAPIResponse = await logseq.App.checkCurrentIsDbGraph();
        globalThis.isLogseqAvailable = typeof isDBGraphAPIResponse === "boolean";
        globalThis.isLogseqCurrentIsDBGraph =
            typeof isDBGraphAPIResponse === "boolean" ? isDBGraphAPIResponse : false;
    } catch {
        globalThis.isLogseqCurrentIsDBGraph = false;
        try {
            // @ts-ignore
            globalThis.isLogseqAvailable = !!(await logseq.App.getCurrentGraph());
        } catch (e) {
            globalThis.isLogseqAvailable = false;
        }
        // biome-ignore lint/suspicious/noConsole: logger not present in test mode
        console.log("Logseq not available - some tests will be skipped");
    }

    // Check Anki availability
    try {
        // @ts-ignore
        const response = await fetch("http://localhost:8765", {
            method: "POST",
            body: JSON.stringify({action: "version", version: 6})
        });
        globalThis.isAnkiAvailable = response.ok;
    } catch {
        globalThis.isAnkiAvailable = false;
    }
}
