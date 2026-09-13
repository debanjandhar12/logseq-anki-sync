import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {UpdateBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/UpdateBlockCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName = "test-update-block-command";
const tagPageName = "test-update-block-command-tag";
const propertyKey = "test-update-block-command-property";
const originalContent = "Original update block content";
const updatedContent = "Updated block content";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("UpdateBlockCommand", () => {
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

        const rawBlock = (await logseq.Editor.appendBlockInPage(page.uuid, originalContent))!;
        block = (await logseq.Editor.getBlock(rawBlock.uuid))!;
    }, 60_000);

    afterAll(async () => {
        for (const name of [pageName, tagPageName, propertyKey]) await deletePagePermanently(name);
    }, 60_000);

    it("should update block content and revert it.", async () => {
        const command = new UpdateBlockCommand({blockUuid: block.uuid, content: updatedContent});

        await command.execute();

        expect(command.getChangedPages()).toEqual([page.uuid]);
        const updatedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(updatedBlock?.content).toBe(updatedContent);

        await command.revert();

        const revertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(revertedBlock?.content).toBe(originalContent);
    }, 60_000);

    it("Trying to update a page as a block throws.", async () => {
        const command = new UpdateBlockCommand({blockUuid: page.uuid, content: updatedContent});

        await expect(command.execute()).rejects.toThrow(
            "Cannot update a page. Block UUID provided must be that of a block."
        );
    }, 60_000);

    it("Trying to update a tag page throws.", async () => {
        const tag = await logseq.Editor.createTag(tagPageName);

        try {
            const command = new UpdateBlockCommand({blockUuid: tag!.uuid, content: updatedContent});
            await expect(command.execute()).rejects.toThrow(
                "Cannot update a tag page using UpdateBlockCommand."
            );
        } finally {
            await deletePagePermanently(tagPageName);
        }
    }, 60_000);

    it("Trying to update a property page throws.", async () => {
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        const property = await logseq.Editor.getProperty(propertyKey);

        try {
            const command = new UpdateBlockCommand({
                blockUuid: property!.uuid,
                content: updatedContent
            });
            await expect(command.execute()).rejects.toThrow(
                "Cannot update a property page using UpdateBlockCommand."
            );
        } finally {
            await deletePagePermanently(propertyKey);
        }
    }, 60_000);
});
