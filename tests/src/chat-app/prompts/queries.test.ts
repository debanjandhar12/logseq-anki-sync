import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

const pageName = "InsertBlockCommandTestPage_" + Date.now();
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("Queries defined in skill files work correctly", () => {
    let page: PageEntity;

    beforeAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: true});
        if (!page) {
            // in some cases logseq creates the page but returns null if it already existed
            page = (await logseq.Editor.getPage(pageName))!;
        }

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("SEARCH_BLOCK_AND_PAGES.ds works", async () => {
        const block = await logseq.Editor.insertBlock(page.uuid, "unique title keyword");
        const {default: query} = await import(
            "../../../../src/chat-app/prompts/queries/SEARCH_BLOCK_AND_PAGES.ds?raw"
        );
        const result = await logseq.DB.datascriptQuery(query);
        await logseq.Editor.removeBlock(block.uuid);
        const resultPrev = await logseq.DB.datascriptQuery(query);
        expect(resultPrev.length).toBe(result.length - 1);
    }, 60_000);
});
