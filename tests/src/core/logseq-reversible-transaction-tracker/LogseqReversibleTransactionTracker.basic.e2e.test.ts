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
const pageNamesToCleanup = new Set<string>([pageName]);

function createPageName(testName: string): string {
    const pageName = `LogseqReversibleTransactionTrackerBasicTestPage_${testName}_${crypto.randomUUID()}`;
    pageNamesToCleanup.add(pageName);
    return pageName;
}

async function cleanupPage(pageName: string): Promise<void> {
    const existingPage = await logseq.Editor.getPage(pageName);
    if (existingPage && !isPageSoftDeleted(existingPage)) {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }
}

describe.skipIf(!shouldRunTests())("LogseqReversibleTransactionTracker basic", () => {
    beforeAll(async () => {
        await cleanupPage(pageName);
    }, 60_000);

    afterAll(async () => {
        for (const pageName of pageNamesToCleanup) {
            await cleanupPage(pageName);
        }
    }, 60_000);

    // tests serialization
    it("executes and reverts page creation, then executes and reverts a transaction with an inserted block", async () => {
        let tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName}));

        const createdPage = (await tracker.execute()) as PageEntity;
        expect(createdPage.uuid).toBeTruthy();
        expect(await logseq.Editor.getPage(pageName)).not.toBeNull();

        await tracker.revertAppliedCommands();
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

        await tracker.revertAppliedCommands();
        await waitForLogseqDb();

        expect(await logseq.Editor.getBlock(insertedBlock.uuid)).toBeNull();
        const revertedTransactionPage = await logseq.Editor.getPage(pageName);
        expect(revertedTransactionPage).not.toBeNull();
        expect(isPageSoftDeleted(revertedTransactionPage!)).toBe(true);
    }, 60_000);

    it("executes incrementally and reverts only the applied prefix", async () => {
        const pageName = createPageName("incremental");
        const pendingPageName = createPageName("incremental_pending");
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName}));

        const createdPage = (await tracker.execute()) as PageEntity;
        expect(createdPage.uuid).toBeTruthy();
        expect(tracker.getAppliedCommandCount()).toBe(1);
        expect(tracker.getChangedPages()).toEqual([createdPage.uuid]);

        tracker.addCommand(
            new InsertBlockCommand({
                parentUuid: createdPage.uuid,
                content: blockContent,
                sibling: false
            })
        );
        const insertedBlock = (await tracker.execute()) as BlockEntity;
        tracker.addCommand(new CreatePageCommand({pageName: pendingPageName}));

        expect(insertedBlock.content).toBe(blockContent);
        expect(tracker.getAppliedCommandCount()).toBe(2);
        expect(await logseq.Editor.getBlock(insertedBlock.uuid)).not.toBeNull();
        expect(await logseq.Editor.getPage(pendingPageName)).toBeNull();

        await tracker.revertAppliedCommands();
        await waitForLogseqDb();

        expect(await logseq.Editor.getBlock(insertedBlock.uuid)).toBeNull();
        const revertedPage = await logseq.Editor.getPage(pageName);
        expect(revertedPage).not.toBeNull();
        expect(isPageSoftDeleted(revertedPage!)).toBe(true);
        expect(await logseq.Editor.getPage(pendingPageName)).toBeNull();
        expect(tracker.getAppliedCommandCount()).toBe(0);
    }, 60_000);

    it("checks abort signals before starting commands", async () => {
        const pageName = createPageName("execute_abort");
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName}));
        const controller = new AbortController();
        controller.abort();

        await expect(tracker.execute({signal: controller.signal})).rejects.toMatchObject({
            name: "AbortError"
        });
        expect(tracker.getAppliedCommandCount()).toBe(0);
        expect(await logseq.Editor.getPage(pageName)).toBeNull();
    }, 60_000);

    it("checks abort signals before reverting commands", async () => {
        const pageName = createPageName("revert_abort");
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new CreatePageCommand({pageName}));
        const createdPage = (await tracker.execute()) as PageEntity;
        expect(await logseq.Editor.getPage(createdPage.uuid)).not.toBeNull();

        const controller = new AbortController();
        controller.abort();
        await expect(
            tracker.revertAppliedCommands({signal: controller.signal})
        ).rejects.toMatchObject({
            name: "AbortError"
        });
        await waitForLogseqDb();

        expect(await logseq.Editor.getPage(createdPage.uuid)).not.toBeNull();
        expect(tracker.getAppliedCommandCount()).toBe(1);

        await tracker.revertAppliedCommands();
    }, 60_000);
});
