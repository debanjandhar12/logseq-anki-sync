import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {DeletePageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/DeletePageCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName = "test-delete-page-command";
const tagPageName = "test-delete-page-command-tag";
const propertyKey = "test-delete-page-command-property";
const blockContent = "DeletePageCommand test block";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("DeletePageCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;

    beforeAll(async () => {
        for (const name of [pageName, tagPageName, propertyKey]) await deletePagePermanently(name);

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: true}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        const rawBlock = (await logseq.Editor.appendBlockInPage(page.uuid, blockContent))!;
        block = (await logseq.Editor.getBlock(rawBlock.uuid))!;
    }, 60_000);

    afterAll(async () => {
        for (const name of [pageName, tagPageName, propertyKey]) await deletePagePermanently(name);
    }, 60_000);

    it("Delete page using execute() and then revert works.", async () => {
        const command = new DeletePageCommand({pageUuid: page.uuid});

        await command.execute();

        await command.revert();

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
        const tag = await logseq.Editor.createTag(tagPageName);

        const command = new DeletePageCommand({pageUuid: tag!.uuid});
        await expect(command.execute()).rejects.toThrow(
            "Cannot delete a tag page using DeletePageCommand."
        );
    }, 60_000);

    it("Trying to delete a property page throws.", async () => {
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        const property = await logseq.Editor.getProperty(propertyKey);

        const command = new DeletePageCommand({pageUuid: property!.uuid});
        await expect(command.execute()).rejects.toThrow(
            "Cannot delete a property page using DeletePageCommand."
        );
    }, 60_000);
});
