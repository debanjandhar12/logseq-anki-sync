import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {MoveBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/MoveBlockCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName1 = "test-move-block-command-page-1";
const pageName2 = "test-move-block-command-page-2";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("MoveBlockCommand", () => {
    let page1: PageEntity;
    let page2: PageEntity;

    beforeAll(async () => {
        await deletePagePermanently(pageName1);
        await deletePagePermanently(pageName2);

        page1 = await logseq.Editor.createPage(
            pageName1,
            {},
            {redirect: false, createFirstBlock: true}
        );
        if (!page1) page1 = (await logseq.Editor.getPage(pageName1))!;

        page2 = await logseq.Editor.createPage(
            pageName2,
            {},
            {redirect: false, createFirstBlock: true}
        );
        if (!page2) page2 = (await logseq.Editor.getPage(pageName2))!;
    }, 60_000);

    afterAll(async () => {
        await deletePagePermanently(pageName1);
        await deletePagePermanently(pageName2);
    }, 60_000);

    it("Moving block from one page to another page works.", async () => {
        const srcBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Test Block A");
        const destPageUuid = page2.uuid;

        const command = new MoveBlockCommand({
            srcBlockUuid: srcBlock!.uuid,
            destBlockUuid: destPageUuid,
            children: true
        });

        await command.execute();

        const movedBlock = await logseq.Editor.getBlock(srcBlock!.uuid);
        expect(movedBlock).not.toBeNull();
        expect(movedBlock!.page.id).toBe(page2.id);

        await command.revert();
    }, 60_000);

    // This works in logseq but errors out in the plugin. This is ok for now as we dont know how to revert this op yet.
    // it("Trying to move a page under another page works with children true works.", async () => {
    //     const command = new MoveBlockCommand({
    //         srcBlockUuid: page1.uuid,
    //         destBlockUuid: page2.uuid,
    //         children: true
    //     });
    //
    //     await command.execute();
    //     await command.revert();
    // }, 60_000);

    it("Trying to move a page under another page throws.", async () => {
        const command = new MoveBlockCommand({
            srcBlockUuid: page1.uuid,
            destBlockUuid: page2.uuid,
            children: false
        });

        await expect(command.execute()).rejects.toThrow(
            "Cannot move a page. Src block UUID must be a block UUID."
        );
    }, 60_000);

    it("Moving block from one place to another block works. Use block uuid for desk.", async () => {
        const srcBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Source Block D");
        const destBlock = await logseq.Editor.appendBlockInPage(page2.uuid, "Dest Block D");

        const command = new MoveBlockCommand({
            srcBlockUuid: srcBlock!.uuid,
            destBlockUuid: destBlock!.uuid,
            children: true
        });

        await command.execute();

        const movedBlock = await logseq.Editor.getBlock(srcBlock!.uuid);
        expect(movedBlock!.parent.id).toBe(destBlock!.id);

        await command.revert();
    }, 60_000);

    it("Trying to move a parent block under it's own children block throws.", async () => {
        const parentBlock = await logseq.Editor.appendBlockInPage(page1.uuid, "Parent Block E");
        const childBlock = await logseq.Editor.insertBlock(parentBlock!.uuid, "Child Block E", {
            sibling: false
        });

        const command = new MoveBlockCommand({
            srcBlockUuid: parentBlock!.uuid,
            destBlockUuid: childBlock!.uuid,
            children: true
        });

        await expect(command.execute()).rejects.toThrow();
    }, 60_000);

    it("should throw error when children is true and before is true.", () => {
        expect(() => {
            new MoveBlockCommand({
                srcBlockUuid: "00000000-0000-4000-8000-000000000001",
                destBlockUuid: "00000000-0000-4000-8000-000000000002",
                children: true,
                before: true
            });
        }).toThrow("When `children` is true, omit `before`.");
    });
});
