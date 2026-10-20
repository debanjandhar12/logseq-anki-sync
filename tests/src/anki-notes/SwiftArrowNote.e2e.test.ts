import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {SwiftArrowNote} from "../../../src/anki-notes/SwiftArrowNote";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const pageName = "test-swift-arrow-note";

describe("SwiftArrowNote E2E Tests", () => {
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
