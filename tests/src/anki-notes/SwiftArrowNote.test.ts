import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {SwiftArrowNote} from "../../../src/anki-notes/SwiftArrowNote";

describe("SwiftArrowNote E2E Tests", () => {
    let page: PageEntity;

    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test SwiftArrowNote E2E",
            {},
            {redirect: false, createFirstBlock: false}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        await logseq.Editor.deletePage("Test SwiftArrowNote E2E");
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test.skipIf(!globalThis.isLogseqAvailable)(
        "Creates notes for all arrow directions",
        async () => {
            const initialNotes = await SwiftArrowNote.getNotesFromLogseqBlocks();
            const initialCount = initialNotes.length;

            await logseq.Editor.appendBlockInPage(page.uuid, "Front :-> Back");
            await logseq.Editor.appendBlockInPage(page.uuid, "Front :<- Back");
            await logseq.Editor.appendBlockInPage(page.uuid, "Front :<-> Back");
            await new Promise((resolve) => setTimeout(resolve, 100));

            const finalNotes = await SwiftArrowNote.getNotesFromLogseqBlocks();
            expect(finalNotes.length).toBe(initialCount + 3);
        }
    );
});
