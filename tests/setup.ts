import "@logseq/libs";
import proxyLogseq from "logseq-proxy";

// Setup logseq proxy before all test cases run
proxyLogseq({
    settings: {},
    config: {
        apiServer: process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
        apiToken: process.env.LOGSEQ_API_TOKEN || ""
    }
});

// Check Logseq availability
try {
    // @ts-ignore
    await logseq.App.getUserInfo();
    globalThis.isLogseqAvailable = true;

    // Check if current graph is DB graph
    // @ts-ignore
    const isDBGraphAPIResponse = await logseq.App.checkCurrentIsDbGraph();
    globalThis.isLogseqCurrentIsDBGraph =
        typeof isDBGraphAPIResponse === "boolean" ? isDBGraphAPIResponse : false;
} catch {
    globalThis.isLogseqAvailable = false;
    globalThis.isLogseqCurrentIsDBGraph = false;
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
