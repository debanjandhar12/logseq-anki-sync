import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {RenamePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/RenamePageCommand";

const pageName = "rename-page-command-test-page-" + Date.now();
const renamedPageName = "rename-page-command-renamed-page-" + Date.now();
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const getPageName = (page: PageEntity) => page.originalName ?? page.name;

describe.skipIf(!shouldRunTests())("RenamePageCommand", () => {
    let page: PageEntity;

    beforeAll(async () => {
        for (const testPageName of [pageName, renamedPageName]) {
            const existingPage = await logseq.Editor.getPage(testPageName);
            if (existingPage) {
                await logseq.Editor.deletePage(testPageName);
                await waitForLogseqDb();
            }
        }

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: false});
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await logseq.Editor.deletePage(renamedPageName);
        await waitForLogseqDb();
    }, 60_000);

    it("should rename page and revert it.", async () => {
        const command = new RenamePageCommand({pageUuid: page.uuid, newName: renamedPageName});

        await command.execute();
        await waitForLogseqDb();

        const renamedPage = await logseq.Editor.getPage(page.uuid);
        expect(renamedPage).not.toBeNull();
        expect(getPageName(renamedPage!)).toBe(renamedPageName);

        await command.revert();
        await waitForLogseqDb();

        const revertedPage = await logseq.Editor.getPage(page.uuid);
        expect(revertedPage).not.toBeNull();
        expect(getPageName(revertedPage!)).toBe(pageName);
    }, 60_000);
});
