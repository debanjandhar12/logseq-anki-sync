import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {HighlightMaskNote} from "../../../src/anki-notes/HighlightMaskNote";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const pageName = "test-highlight-mask-note";

describe("HighlightMaskNote E2E Tests", () => {
    let page: PageEntity | null = null;

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
    }, 60_000);

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Returns empty array for non-DB graphs",
        async () => {
            const isDbGraph = globalThis.isLogseqCurrentIsDBGraph;
            if (isDbGraph) {
                return;
            }

            const notes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            expect(notes).toEqual([]);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Creates notes for blocks with highlight_mask property",
        async () => {
            if (!page) return;

            const isDbGraph = globalThis.isLogseqCurrentIsDBGraph;
            if (!isDbGraph) {
                return;
            }

            const initialNotes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            const initialCount = initialNotes.length;

            await logseq.Editor.appendBlockInPage(page.uuid, "Test content for highlight mask", {
                properties: {
                    highlight_mask: JSON.stringify({
                        elements: [{text: "Test", cId: 1}],
                        config: {},
                        tags: []
                    })
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            expect(finalNotes.length).toBe(initialCount + 1);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Filters out notes without valid highlight data",
        async () => {
            if (!page) return;

            const isDbGraph = globalThis.isLogseqCurrentIsDBGraph;
            if (!isDbGraph) {
                return;
            }

            const initialNotes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            const initialCount = initialNotes.length;

            await logseq.Editor.appendBlockInPage(
                page.uuid,
                "Test content without highlight data",
                {
                    properties: {
                        highlight_mask: JSON.stringify({elements: [], config: {}, tags: []})
                    }
                }
            );
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            expect(finalNotes.length).toBe(initialCount);
        }
    );
});
