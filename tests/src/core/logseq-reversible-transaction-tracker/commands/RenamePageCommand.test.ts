import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {RenamePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/RenamePageCommand";

const pageName = "rename-page-command-test-page-" + Date.now();
const renamedPageName = "rename-page-command-renamed-page-" + Date.now();
const journalDate = new Date(3000, 0, 1 + (Date.now() % 2_000_000), 12);
const journalTargetName = `Aug 22nd, ${journalDate.getFullYear() + 1}`;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const getPageName = (page: PageEntity) => page.originalName ?? page.name;

describe.skipIf(!shouldRunTests())("RenamePageCommand", () => {
    let page: PageEntity;
    let journalPage: PageEntity;

    beforeAll(async () => {
        for (const testPageName of [pageName, renamedPageName]) {
            const existingPage = await logseq.Editor.getPage(testPageName);
            if (existingPage) {
                await logseq.Editor.deletePage(testPageName);
                await waitForLogseqDb();
            }
        }

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;
        journalPage = (await logseq.Editor.createJournalPage(journalDate))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await logseq.Editor.deletePage(renamedPageName);
        if (journalPage) await logseq.Editor.deletePage(journalPage.uuid);
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

    it("does not rename a page to a journal page name", async () => {
        const command = new RenamePageCommand({pageUuid: page.uuid, newName: journalTargetName});

        await expect(command.execute()).rejects.toThrow(
            "Cannot rename a page to a journal page name using RenamePageCommand."
        );
        expect(getPageName((await logseq.Editor.getPage(page.uuid))!)).toBe(pageName);
    }, 60_000);

    it("does not rename a journal page", async () => {
        const command = new RenamePageCommand({
            pageUuid: journalPage.uuid,
            newName: renamedPageName
        });

        await expect(command.execute()).rejects.toThrow(
            "Cannot rename a journal page using RenamePageCommand."
        );
    }, 60_000);
});
