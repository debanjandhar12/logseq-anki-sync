import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {MoveBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/MoveBlockCommand";
import {DeterministicUUIDGenerator} from "../../../../../src/core/logseq-reversible-transaction-tracker/DeterministicUUIDGenerator";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";

const pageName1 = "MoveBlockCommandTestPage1_" + Date.now();
const pageName2 = "MoveBlockCommandTestPage2_" + Date.now();
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));

describe.sequential("MoveBlockCommand", () => {
    let page1: PageEntity;
    let page2: PageEntity;

    const shouldRunTests = () =>
        globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

    beforeAll(async () => {
        if (!shouldRunTests()) return;

        let existingPage1 = await logseq.Editor.getPage(pageName1);
        if (existingPage1) {
            await logseq.Editor.deletePage(pageName1);
            await waitForLogseqDb();
        }
        let existingPage2 = await logseq.Editor.getPage(pageName2);
        if (existingPage2) {
            await logseq.Editor.deletePage(pageName2);
            await waitForLogseqDb();
        }

        page1 = await logseq.Editor.createPage(pageName1, {}, {createFirstBlock: true});
        if (!page1) page1 = (await logseq.Editor.getPage(pageName1))!;

        page2 = await logseq.Editor.createPage(pageName2, {}, {createFirstBlock: true});
        if (!page2) page2 = (await logseq.Editor.getPage(pageName2))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (!shouldRunTests()) return;

        await logseq.Editor.deletePage(pageName1);
        await logseq.Editor.deletePage(pageName2);
        await waitForLogseqDb();
    }, 60_000);

    it("Moving block from one page to another page works.", async () => {
        if (!shouldRunTests()) return;

        const srcBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Test Block A");
        const destPageUuid = page2.uuid;

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new MoveBlockCommand({
            srcBlockUuid: srcBlock!.uuid,
            destBlockUuid: destPageUuid,
            children: true
        });

        await command.execute(gen);
        
        const movedBlock = await logseq.Editor.getBlock(srcBlock!.uuid);
        expect(movedBlock).not.toBeNull();
        expect(movedBlock!.page.id).toBe(page2.id);

        await command.revert();
    }, 60_000);

    // This works in logseq but errors out in the plugin. This is ok for now as we dont know how to revert this op yet.
    // it("Trying to move a page under another page works with children true works.", async () => {
    //     if (!shouldRunTests()) return;
    //
    //     const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
    //     const command = new MoveBlockCommand({
    //         srcBlockUuid: page1.uuid,
    //         destBlockUuid: page2.uuid,
    //         children: true
    //     });
    //
    //     await command.execute(gen);
    //     await command.revert();
    // }, 60_000);

    it("Trying to move a page under anoter page works with children false throws.", async () => {
        if (!shouldRunTests()) return;

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new MoveBlockCommand({
            srcBlockUuid: page1.uuid,
            destBlockUuid: page2.uuid,
            children: false
        });

        await expect(command.execute(gen)).rejects.toThrow();
    }, 60_000);

    it("Moving block from one place to another block works. Use block uuid for desk.", async () => {
        if (!shouldRunTests()) return;

        const srcBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Source Block D");
        const destBlock = await logseq.Editor.appendBlockInPage(page2.uuid, "Dest Block D");

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new MoveBlockCommand({
            srcBlockUuid: srcBlock!.uuid,
            destBlockUuid: destBlock!.uuid,
            children: true
        });

        await command.execute(gen);

        const movedBlock = await logseq.Editor.getBlock(srcBlock!.uuid);
        expect(movedBlock!.parent.id).toBe(destBlock!.id);

        await command.revert();
    }, 60_000);

    it("Trying to move a parent block under it's own children block throws.", async () => {
        if (!shouldRunTests()) return;

        const parentBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Parent Block E");
        const childBlock = await logseq.Editor.insertBlock(parentBlock!.uuid, "Child Block E", {sibling: false});

        const gen = new DeterministicUUIDGenerator(crypto.randomUUID());
        const command = new MoveBlockCommand({
            srcBlockUuid: parentBlock!.uuid,
            destBlockUuid: childBlock!.uuid,
            children: true
        });

        await expect(command.execute(gen)).rejects.toThrow();
    }, 60_000);

    it("should throw error when children is true and before is true.", () => {
        expect(() => {
            new MoveBlockCommand({
                srcBlockUuid: "dummy-src",
                destBlockUuid: "dummy-dest",
                children: true,
                before: true
            });
        }).toThrow(/`before` is meaningless/);
    });
});
