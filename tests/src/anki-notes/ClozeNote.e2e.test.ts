import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {ClozeNote} from "../../../src/anki-notes/ClozeNote";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const pageName = "test-cloze-note";

describe("ClozeNote E2E Tests", () => {
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

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Creates notes for all cloze syntax variants",
        async () => {
            const initialNotes = await ClozeNote.getNotesFromLogseqBlocks();
            const initialCount = initialNotes.length;

            await logseq.Editor.appendBlockInPage(page.uuid, "{{c1 A}}");
            await logseq.Editor.appendBlockInPage(page.uuid, "{{c9 B}}");
            await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze1 C}}");
            await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze9 D}}");
            await logseq.Editor.appendBlockInPage(page.uuid, "{{cloze E}}");
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await ClozeNote.getNotesFromLogseqBlocks();
            expect(finalNotes.length).toBe(initialCount + 5);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
        "Creates note with replacecloze property",
        async () => {
            const initialNotes = await ClozeNote.getNotesFromLogseqBlocks();
            const initialCount = initialNotes.length;

            await logseq.Editor.appendBlockInPage(page.uuid, "$c =\\sqrt{ a^{2}+b^{2} }$", {
                properties: {replacecloze: "a^{2}+b^{2}, /(c\\^2|c )/gi"}
            });
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await ClozeNote.getNotesFromLogseqBlocks();
            expect(finalNotes.length).toBe(initialCount + 1);
        }
    );
});
