import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {HighlightMaskNote} from "../../../src/anki-notes/HighlightMaskNote";

describe("HighlightMaskNote E2E Tests", () => {
    let page: PageEntity | null = null;

    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test HighlightMaskNote E2E",
            {},
            {redirect: false, createFirstBlock: false}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        if (page) {
            await logseq.Editor.deletePage("Test HighlightMaskNote E2E");
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    });

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Returns empty array for non-DB graphs",
        async () => {
            const isDbGraph = await logseq.App.checkCurrentIsDbGraph();
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

            const isDbGraph = await logseq.App.checkCurrentIsDbGraph();
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

            const isDbGraph = await logseq.App.checkCurrentIsDbGraph();
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
