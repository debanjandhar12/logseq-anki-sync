import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {
    CreatePageCommand,
    InsertBlockCommand,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {isPageSoftDeleted} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";

const pageName = "LogseqReversibleTransactionTrackerBasicTestPage_" + crypto.randomUUID();
const blockContent = "LogseqReversibleTransactionTracker basic test block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("LogseqReversibleTransactionTracker basic", () => {
    beforeAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage && !isPageSoftDeleted(existingPage)) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }
    }, 60_000);

    afterAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage && !isPageSoftDeleted(existingPage)) {
            await logseq.Editor.deletePage(pageName);
        }
        await waitForLogseqDb();
    }, 60_000);

    it("executes and reverts page creation, then executes and reverts a transaction with an inserted block", async () => {
        let tracker = new LogseqReversibleTransactionTracker(crypto.randomUUID());
        tracker.addCommand(new CreatePageCommand({pageName}));

        const createdPage = (await tracker.execute()) as PageEntity;
        expect(createdPage.uuid).toBeTruthy();
        expect(await logseq.Editor.getPage(pageName)).not.toBeNull();

        await tracker.revert();
        await waitForLogseqDb();
        const revertedPage = await logseq.Editor.getPage(pageName);
        expect(revertedPage).not.toBeNull();
        expect(isPageSoftDeleted(revertedPage!)).toBe(true);

        tracker = LogseqReversibleTransactionTrackerSerializer.deserialize(
            LogseqReversibleTransactionTrackerSerializer.serialize(tracker)
        );

        tracker.addCommand(
            new InsertBlockCommand({
                parentUuid: createdPage.uuid,
                content: blockContent,
                sibling: false
            })
        );

        const insertedBlock = (await tracker.execute()) as BlockEntity;
        expect(insertedBlock.content).toBe(blockContent);
        expect(await logseq.Editor.getPage(pageName)).not.toBeNull();
        expect(await logseq.Editor.getBlock(insertedBlock.uuid)).not.toBeNull();

        await tracker.revert();
        await waitForLogseqDb();

        expect(await logseq.Editor.getBlock(insertedBlock.uuid)).toBeNull();
        const revertedTransactionPage = await logseq.Editor.getPage(pageName);
        expect(revertedTransactionPage).not.toBeNull();
        expect(isPageSoftDeleted(revertedTransactionPage!)).toBe(true);
    }, 60_000);
});
