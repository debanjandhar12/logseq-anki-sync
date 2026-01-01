import "@logseq/libs"
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {MultilineCardNote} from "../../../src/anki-notes/MultilineCardNote";
import {PageEntity} from "@logseq/libs/dist/LSPlugin";

describe("MultilineCardNote E2E Tests", () => {
    let page: PageEntity;
    
    beforeEach(async () => {
        page = await logseq.Editor.createPage('Test MultilineCardNote E2E', {}, {createFirstBlock: false});
    });

    afterEach(async () => {
        await logseq.Editor.deletePage('Test MultilineCardNote E2E');
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with #card tag", async () => {
        const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        const initialCount = initialNotes.length;

        const parentBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Parent #card");
        await logseq.Editor.insertBlock(parentBlock.uuid, "Child");

        const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        expect(finalNotes.length).toBe(initialCount + 1);
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with #flashcard tag", async () => {
        const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        const initialCount = initialNotes.length;

        const parentBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Parent #flashcard");
        await logseq.Editor.insertBlock(parentBlock.uuid, "Child");

        const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        expect(finalNotes.length).toBe(initialCount + 1);
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates multiple notes with #card-group tag", async () => {
        const initialNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        const initialCount = initialNotes.length;

        const rootBlock = await logseq.Editor.appendBlockInPage(page.uuid, "Root");
        
        const card1Parent = await logseq.Editor.insertBlock(rootBlock.uuid, "Parent Card 1 #card-group");
        await logseq.Editor.insertBlock(card1Parent.uuid, "Child Card 1");
        
        const card2Parent = await logseq.Editor.insertBlock(rootBlock.uuid, "Parent Card 2 #card-group");
        await logseq.Editor.insertBlock(card2Parent.uuid, "Child Card 2");

        const finalNotes = await MultilineCardNote.getNotesFromLogseqBlocks([]);
        expect(finalNotes.length).toBe(initialCount + 2);
    });
});
