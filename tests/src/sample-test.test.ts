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
