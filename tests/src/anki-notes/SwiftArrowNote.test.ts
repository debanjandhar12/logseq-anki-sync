import "@logseq/libs"
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {SwiftArrowNote} from "../../../src/anki-notes/SwiftArrowNote";
import {PageEntity} from "@logseq/libs/dist/LSPlugin";

describe("SwiftArrowNote E2E Tests", () => {
    let page: PageEntity;
    
    beforeEach(async () => {
        page = await logseq.Editor.createPage('Test SwiftArrowNote E2E', {}, {createFirstBlock: false});
    });

    afterEach(async () => {
        await logseq.Editor.deletePage('Test SwiftArrowNote E2E');
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates notes for all arrow directions", async () => {
        const initialNotes = await SwiftArrowNote.getNotesFromLogseqBlocks();
        const initialCount = initialNotes.length;

        await logseq.Editor.appendBlockInPage(page.uuid, "Front :-> Back");
        await logseq.Editor.appendBlockInPage(page.uuid, "Front :<- Back");
        await logseq.Editor.appendBlockInPage(page.uuid, "Front :<-> Back");

        const finalNotes = await SwiftArrowNote.getNotesFromLogseqBlocks();
        expect(finalNotes.length).toBe(initialCount + 3);
    });
});
