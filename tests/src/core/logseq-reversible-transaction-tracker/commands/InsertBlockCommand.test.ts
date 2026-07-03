import {afterAll, beforeAll, describe} from "vitest";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

const pageName = "InsertBlockCommandTestPage";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));

describe("Logseq DB query skill examples", () => {
    let page: PageEntity;

    const shouldRunTests = () =>
        globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
    beforeAll(async () => {
        if (!shouldRunTests()) return;

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: false});

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (!shouldRunTests()) return;

        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);
});