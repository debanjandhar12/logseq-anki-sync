import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {DeleteBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/DeleteBlockCommand";

const pageName = "DeleteBlockCommandTestPage_" + Date.now();
const anchorBlockContent = "DeleteBlockCommand anchor block";
const blockContent = "DeleteBlockCommand test block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("DeleteBlockCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;

    beforeAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: true});
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        await logseq.Editor.appendBlockInPage(page.uuid, anchorBlockContent);
        const rawBlock = (await logseq.Editor.appendBlockInPage(page.uuid, blockContent))!;
        block = (await logseq.Editor.getBlock(rawBlock.uuid))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("Delete block using execute() and then revert works.", async () => {
        const command = new DeleteBlockCommand({blockUuid: block.uuid});

        await command.execute();
        await waitForLogseqDb();

        await command.revert();
        await waitForLogseqDb();

        const revertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(revertedBlock).not.toBeNull();
        expect(revertedBlock!.content).toBe(blockContent);
    }, 60_000);

    it("Trying to delete a page as a block throws.", async () => {
        const command = new DeleteBlockCommand({blockUuid: page.uuid});

        await expect(command.execute()).rejects.toThrow();
    }, 60_000);
});
