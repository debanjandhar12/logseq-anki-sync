import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {RestorePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/RestorePageCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName = "test-restore-page-command";
const activePageName = "test-restore-page-command-active";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("RestorePageCommand", () => {
    let page: PageEntity;
    let activePage: PageEntity;

    beforeAll(async () => {
        for (const testPageName of [pageName, activePageName]) {
            await deletePagePermanently(testPageName);
        }

        const createdPage = await logseq.Editor.createPage(
            pageName,
            {},
            {
                redirect: false,
                createFirstBlock: true
            }
        );
        page = createdPage ?? (await logseq.Editor.getPage(pageName))!;

        const createdActivePage = await logseq.Editor.createPage(
            activePageName,
            {},
            {
                redirect: false,
                createFirstBlock: true
            }
        );
        activePage = createdActivePage ?? (await logseq.Editor.getPage(activePageName))!;

        await logseq.Editor.deletePage(page.uuid);
    }, 60_000);

    afterAll(async () => {
        await deletePagePermanently(pageName);
        await deletePagePermanently(activePageName);
    }, 60_000);

    it("Restore a soft-deleted page using execute() and then revert works.", async () => {
        const command = new RestorePageCommand({pageUuid: page.uuid});

        const restoredPage = await command.execute();
        expect(restoredPage.uuid).toBe(page.uuid);

        await command.revert();

        const revertedPage = await logseq.Editor.getPage(page.uuid);
        expect(revertedPage).not.toBeNull();
    }, 60_000);

    it("Restore throws when the page exists and is not deleted.", async () => {
        const command = new RestorePageCommand({pageUuid: activePage.uuid});

        await expect(command.execute()).rejects.toThrow("Page is not deleted");
    }, 60_000);
});
