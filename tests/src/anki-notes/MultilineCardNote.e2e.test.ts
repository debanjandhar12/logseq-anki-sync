import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {MultilineCardNote} from "../../../src/anki-notes/MultilineCardNote";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const pageName = "test-multiline-card-note";

describe("MultilineCardNote E2E Tests", () => {
    let page: PageEntity;

    beforeEach(async () => {
        await deletePagePermanently(pageName);
        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: true}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }, 60_000);

    afterEach(async () => {
        await deletePagePermanently(pageName);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }, 60_000);

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with #card tag", async () => {
        const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        const initialCount = initialNotes.length;

        const parentBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Parent #card");
        await logseq.Editor.insertBlock(parentBlock.uuid, "Child");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        expect(finalNotes.length).toBe(initialCount + 1);
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with #flashcard tag", async () => {
        const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        const initialCount = initialNotes.length;

        const parentBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Parent #flashcard");
        await logseq.Editor.insertBlock(parentBlock.uuid, "Child");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        expect(finalNotes.length).toBe(initialCount + 1);
    });

    test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
        "incremental, depth and direction tags work in file version (#335, #338)",
        async () => {
            const parent = await logseq.Editor.appendBlockInPage(
                page.uuid,
                "Question #card #incremental #[[bidirectional]] #depth-1"
            );
            const first = await logseq.Editor.insertBlock(parent.uuid, "Answer one");
            await logseq.Editor.insertBlock(first.uuid, "Excluded grandchild");
            await logseq.Editor.insertBlock(first.uuid, "Answer two", {sibling: true});
            await new Promise((resolve) => setTimeout(resolve, 100));

            const notes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
            const note = notes.find(({uuid}) => uuid === parent.uuid);
            expect(note?.tags).toEqual(["card", "incremental", "bidirectional", "depth-1"]);
            const {html} = await note!.getClozedContentHTML();
            expect([...html.matchAll(/\{\{c(\d+)::/g)].map((match) => match[1])).toEqual([
                "2",
                "1",
                "3"
            ]);
            expect(html).not.toContain("Excluded grandchild");
            expect(html).not.toMatch(/placeholder|\{\{c\d*::\s*\}\}/);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Creates multiple notes with #card-group tag",
        async () => {
            const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
            const initialCount = initialNotes.length;

            const rootBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Root");

            const card1Parent = await logseq.Editor.insertBlock(
                rootBlock.uuid,
                "Parent Card 1 #card-group"
            );
            await logseq.Editor.insertBlock(card1Parent.uuid, "Child Card 1");

            const card2Parent = await logseq.Editor.insertBlock(
                rootBlock.uuid,
                "Parent Card 2 #card-group"
            );
            await logseq.Editor.insertBlock(card2Parent.uuid, "Child Card 2");
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
            expect(finalNotes.length).toBe(initialCount + 2);
        }
    );
});
