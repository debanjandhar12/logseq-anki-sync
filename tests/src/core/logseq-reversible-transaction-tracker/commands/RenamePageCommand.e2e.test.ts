import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {RenamePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/RenamePageCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName = "test-rename-page-command";
const renamedPageName = "test-rename-page-command-renamed";
const journalDate = new Date(3000, 0, 2, 12);
const journalDay = 30000102; // Jan 2nd, 3000
const journalTargetName = `Aug 22nd, ${journalDate.getFullYear() + 1}`;
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const getPageName = (page: PageEntity) => page.originalName ?? page.name;

describe.skipIf(!shouldRunTests())("RenamePageCommand", () => {
    let page: PageEntity;
    let journalPage: PageEntity;

    beforeAll(async () => {
        for (const testPageName of [pageName, renamedPageName]) {
            await deletePagePermanently(testPageName);
        }
        const existingJournals = (await logseq.DB.datascriptQuery(
            `[:find ?uuid
              :in $ ?day
              :where
              [?page :block/journal-day ?day]
              [?page :block/uuid ?uuid]]`,
            journalDay
        )) as [string][];
        for (const [uuid] of existingJournals) await deletePagePermanently(uuid);

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;
        journalPage = (await logseq.Editor.createJournalPage(journalDate))!;
    }, 60_000);

    afterAll(async () => {
        for (const name of [pageName, renamedPageName]) await deletePagePermanently(name);
        if (journalPage) await deletePagePermanently(journalPage.uuid);
    }, 60_000);

    it("should rename page and revert it.", async () => {
        const command = new RenamePageCommand({pageUuid: page.uuid, newName: renamedPageName});

        await command.execute();

        const renamedPage = await logseq.Editor.getPage(page.uuid);
        expect(renamedPage).not.toBeNull();
        expect(getPageName(renamedPage!)).toBe(renamedPageName);

        await command.revert();

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
