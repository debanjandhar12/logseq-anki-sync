import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {InsertBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/InsertBlockCommand";
import {DeterministicUUIDGenerator} from "../../../../../src/core/logseq-reversible-transaction-tracker/DeterministicUUIDGenerator";

const pageName = "InsertBlockCommandTestPage_" + Date.now();
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));

describe.sequential("InsertBlockCommand", () => {
    let page: PageEntity;

    const shouldRunTests = () =>
        globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

    beforeAll(async () => {
        if (!shouldRunTests()) return;

        let existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: true});
        if (!page) {
            // in some cases logseq creates the page but returns null if it already existed
            page = (await logseq.Editor.getPage(pageName))!;
        }

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (!shouldRunTests()) return;

        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("should insert block into a page by page uuid, and revert it", async () => {
        if (!shouldRunTests()) return;

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new InsertBlockCommand({
            parentUuid: page.uuid,
            content: "Test Block 1",
            sibling: false
        });

        const block = await command.execute(gen);
        expect(block.content).toBe("Test Block 1");

        const insertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(insertedBlock).not.toBeNull();

        await command.revert();

        const revertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(revertedBlock).toBeNull();
    }, 60_000);

    it("should insert block by block uuid, and revert it", async () => {
        if (!shouldRunTests()) return;

        const parentBlockRaw = await logseq.Editor.appendBlockInPage(page.uuid, "Parent Block");
        const parentBlock = (await logseq.Editor.getBlock(parentBlockRaw!.uuid))!;
        expect(parentBlock).not.toBeNull();

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new InsertBlockCommand({
            parentUuid: parentBlock!.uuid,
            content: "Test Block 2",
            sibling: true // Insert as sibling to parentBlock
        });

        const block = await command.execute(gen);
        expect(block.content).toBe("Test Block 2");

        const insertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(insertedBlock).not.toBeNull();
        expect(insertedBlock!.parent.id).toBe(parentBlock!.parent.id);

        await command.revert();

        const revertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(revertedBlock).toBeNull();
    }, 60_000);

    it("should insert block as child when sibling is false", async () => {
        if (!shouldRunTests()) return;

        const parentBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Parent Block 3");
        expect(parentBlock).not.toBeNull();

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new InsertBlockCommand({
            parentUuid: parentBlock!.uuid,
            content: "Test Block 3 (child)",
            sibling: false
        });

        const block = await command.execute(gen);
        expect(block.content).toBe("Test Block 3 (child)");

        const insertedBlock = await logseq.Editor.getBlock(block.uuid);
        expect(insertedBlock).not.toBeNull();
        expect(insertedBlock!.parent.id).toBe(parentBlock!.id);

        await command.revert();
    }, 60_000);

    it("should throw error when sibling is false and before is true", () => {
        expect(() => {
            new InsertBlockCommand({
                parentUuid: page ? page.uuid : "dummy-uuid",
                content: "Error Block",
                sibling: false,
                before: true
            });
        }).toThrow(/`before` is meaningless/);
    }, 60_000);
});
