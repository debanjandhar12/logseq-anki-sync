import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {HighlightMaskNote} from "../../../src/anki-notes/HighlightMaskNote";
import {ANKI_CLOZE_REGEXP} from "../../../src/constants";
import getUUIDFromBlock from "../../../src/logseq/getUUIDFromBlock";
import {ObjectPropertyDataManager} from "../../../src/utils/ObjectPropertyDataManager";
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

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "Escapes closing cloze delimiters in highlight hints during HTML conversion",
        async () => {
            expect(page).not.toBeNull();
            const highlightData = {
                elements: [
                    {
                        text: "Test",
                        cId: 1,
                        prefix: "",
                        suffix: " content for highlight mask",
                        hint: "hint}}stillhint"
                    }
                ],
                config: {},
                tags: []
            };
            const block = await logseq.Editor.appendBlockInPage(
                page!.uuid,
                "Test content for highlight mask",
                {properties: {highlight_mask: JSON.stringify(highlightData)}}
            );
            expect(block).not.toBeNull();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const notes = await HighlightMaskNote.getNotesFromLogseqBlocks();
            const note = notes.find((note) => note.uuid === getUUIDFromBlock(block!));
            expect(note).toBeDefined();

            const result = await note!.getClozedContentHTML();
            const clozes = Array.from(result.html.matchAll(ANKI_CLOZE_REGEXP));
            expect(clozes).toHaveLength(1);
            expect(clozes[0][2]).toBe("1");
            expect(clozes[0][3]).toContain("Test::hint}\u2063}stillhint\u2063");
            expect(ObjectPropertyDataManager.load(note!, "highlight_mask")).toEqual(highlightData);
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
