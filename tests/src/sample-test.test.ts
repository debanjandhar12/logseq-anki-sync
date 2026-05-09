import "@logseq/libs";
import {describe, expect, test} from "vitest";

describe("Logseq", () => {
    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "Basic connect test",
        async () => {
            await logseq.App.getCurrentGraph();
            expect("1").toEqual("1");
        }
    );
});

describe("Anki", () => {
    test.skipIf(!globalThis.isAnkiAvailable)("Basic connect test", async () => {
        const response = await fetch("http://localhost:8765", {
            method: "POST",
            body: JSON.stringify({action: "version", version: 6})
        });
        expect(response.ok).toEqual(true);
    });
});
