import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {UpdateBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/UpdateBlockCommand";

const pageName = "UpdateBlockCommandTestPage_" + Date.now();
const originalContent = "Original update block content";
const updatedContent = "Updated block content";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("UpdateBlockCommand", () => {
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

        const rawBlock = (await logseq.Editor.appendBlockInPage(page.uuid, originalContent))!;
        block = (await logseq.Editor.getBlock(rawBlock.uuid))!;
        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
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
});
