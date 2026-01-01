import "@logseq/libs"
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {ClozeNote} from "../../../src/anki-notes/ClozeNote";
import {PageEntity} from "@logseq/libs/dist/LSPlugin";

describe("ClozeNote E2E Tests", () => {
    let page: PageEntity;
    
    beforeEach(async () => {
        page = await logseq.Editor.createPage('Test ClozeNote E2E', {}, {createFirstBlock: false});
    });

    afterEach(async () => {
        await logseq.Editor.deletePage('Test ClozeNote E2E');
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates notes for all cloze syntax variants", async () => {
        const initialNotes = await ClozeNote.getNotesFromLogseqBlocks();
        const initialCount = initialNotes.length;

        await logseq.Editor.appendBlockInPage(page.uuid, "{{c1 A}}");
        await logseq.Editor.appendBlockInPage(page.uuid, "{{c9 B}}");
        await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze1 C}}");
        await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze9 D}}");
        await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze E}}");

        const finalNotes = await ClozeNote.getNotesFromLogseqBlocks();
        expect(finalNotes.length).toBe(initialCount + 5);
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with replacecloze property", async () => {
        const initialNotes = await ClozeNote.getNotesFromLogseqBlocks();
        const initialCount = initialNotes.length;

        await logseq.Editor.appendBlockInPage(page.uuid, "$$c =\\sqrt{ a^{2}+b^{2} }$$", {
            properties: { replacecloze: "a^{2}+b^{2}, /(c\\^2|c )/gi" }
        });

        const finalNotes = await ClozeNote.getNotesFromLogseqBlocks();
        expect(finalNotes.length).toBe(initialCount + 1);
    });
});
