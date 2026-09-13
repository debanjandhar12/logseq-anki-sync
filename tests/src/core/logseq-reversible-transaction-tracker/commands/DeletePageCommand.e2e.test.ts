import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {DeletePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/DeletePageCommand";

const pageName = "DeletePageCommandTestPage_" + Date.now();
const blockContent = "DeletePageCommand test block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("DeletePageCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;

    beforeAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: true}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        const rawBlock = (await logseq.Editor.appendBlockInPage(page.uuid, blockContent))!;
        block = (await logseq.Editor.getBlock(rawBlock.uuid))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("Delete page using execute() and then revert works.", async () => {
        const command = new DeletePageCommand({pageUuid: page.uuid});

        await command.execute();
        await waitForLogseqDb();

        await command.revert();
        await waitForLogseqDb();

        const revertedPage = await logseq.Editor.getPage(page.uuid);
        expect(revertedPage).not.toBeNull();
        expect(revertedPage!.uuid).toBe(page.uuid);
    }, 60_000);

    it("Trying to delete a block as a page throws.", async () => {
        const command = new DeletePageCommand({pageUuid: block.uuid});

        await expect(command.execute()).rejects.toThrow(
            "Cannot delete a block. Page UUID provided must be that of a page."
        );
    }, 60_000);

    it("Trying to delete a tag page throws.", async () => {
        const tagPageName = `DeletePageCommandTestTag_${Date.now()}`;
        const tag = await logseq.Editor.createTag(tagPageName);
        await waitForLogseqDb();

        const command = new DeletePageCommand({pageUuid: tag!.uuid});
        await expect(command.execute()).rejects.toThrow(
            "Cannot delete a tag page using DeletePageCommand."
        );

        await logseq.Editor.deletePage(tag!.uuid);
        await waitForLogseqDb();
    }, 60_000);

    it("Trying to delete a property page throws.", async () => {
        const propertyKey = `DeletePageCommandTestProperty_${Date.now()}`;
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        await waitForLogseqDb();
        const property = await logseq.Editor.getProperty(propertyKey);

        const command = new DeletePageCommand({pageUuid: property!.uuid});
        await expect(command.execute()).rejects.toThrow(
            "Cannot delete a property page using DeletePageCommand."
        );

        await logseq.Editor.removeProperty(propertyKey);
        await waitForLogseqDb();
    }, 60_000);
});
