import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {CreatePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/CreatePageCommand";
import {getJournalDayByPageUuid} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/getJournalDayByPageUuid";
import {isPageSoftDeleted} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";

const pageName = "CreatePageCommandTestPage_" + Date.now();
const deletedPageName = "CreatePageCommandDeletedPageTestPage_" + Date.now();
const existingPageName = "CreatePageCommandExistingPageTestPage_" + Date.now();
const journalDate = new Date(3000, 0, 1 + (Date.now() % 2_000_000), 12);
const journalDay = journalDate.getDate();
const journalDaySuffix =
    journalDay >= 11 && journalDay <= 13
        ? "th"
        : (["th", "st", "nd", "rd"][journalDay % 10] ?? "th");
const journalPageName = `${journalDate.toLocaleString("en-US", {
    month: "short"
})} ${journalDay}${journalDaySuffix}, ${journalDate.getFullYear()}`;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("CreatePageCommand", () => {
    beforeAll(async () => {
        for (const testPageName of [pageName, deletedPageName, existingPageName]) {
            const existingPage = await logseq.Editor.getPage(testPageName);
            if (existingPage) {
                await logseq.Editor.deletePage(testPageName);
                await waitForLogseqDb();
            }
        }
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await logseq.Editor.deletePage(deletedPageName);
        await logseq.Editor.deletePage(existingPageName);
        await logseq.Editor.deletePage(journalPageName);
        await waitForLogseqDb();
    }, 60_000);

    it("Create page using execute() and then revert and then execute again works.", async () => {
        const command = new CreatePageCommand({pageName});

        const createdPage = await command.execute();
        expect(createdPage.uuid).toBeTruthy();
        expect(await logseq.Editor.getPage(pageName)).not.toBeNull();

        await command.revert();
        await waitForLogseqDb();

        const recreatedPage = await command.execute();
        expect(recreatedPage.uuid).toBe(createdPage.uuid);
        expect(await logseq.Editor.getPage(pageName)).not.toBeNull();
    }, 60_000);

    it("Create page does not restore a page deleted outside its own revert().", async () => {
        await logseq.Editor.createPage(deletedPageName, undefined, {
            redirect: false,
            createFirstBlock: false
        });
        await logseq.Editor.deletePage(deletedPageName);
        await waitForLogseqDb();

        const command = new CreatePageCommand({pageName: deletedPageName});

        await expect(command.execute()).rejects.toThrow(
            `Page already exists as deleted: ${deletedPageName}`
        );
    }, 60_000);

    it("Create page throws when the page already exists and is not deleted.", async () => {
        await logseq.Editor.createPage(existingPageName, undefined, {
            redirect: false,
            createFirstBlock: false
        });
        await waitForLogseqDb();

        const command = new CreatePageCommand({pageName: existingPageName});

        await expect(command.execute()).rejects.toThrow(`Page already exists: ${existingPageName}`);
    }, 60_000);

    it("creates and reverts a journal page", async () => {
        const command = new CreatePageCommand({pageName: journalPageName.toUpperCase()});
        const provisionalUuid = command.pageUuid;

        const createdPage = await command.execute();
        expect(createdPage.uuid).not.toBe(provisionalUuid);
        expect(command.pageUuid).toBe(createdPage.uuid);
        expect(await getJournalDayByPageUuid(createdPage.uuid)).toBe(
            journalDate.getFullYear() * 10_000 +
                (journalDate.getMonth() + 1) * 100 +
                journalDate.getDate()
        );

        await command.revert();
        await waitForLogseqDb();
        const deletedPage = await logseq.Editor.getPage(createdPage.uuid);
        expect(deletedPage).not.toBeNull();
        expect(isPageSoftDeleted(deletedPage!)).toBe(true);
    }, 60_000);
});
