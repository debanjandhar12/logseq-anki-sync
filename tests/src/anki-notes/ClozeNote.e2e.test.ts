import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import * as cheerio from "cheerio";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {ClozeNote} from "../../../src/anki-notes/ClozeNote";
import {LogseqPropertiesHelper} from "../../../src/logseq/LogseqPropertiesHelper";
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
    describe("Regression Cases", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Preserves clozes after a blank line following a heading and id property (#354)",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "# Some heading");
                expect(block).not.toBeNull();
                const blockUuid = block!.uuid;
                const content = `# Some heading
id:: ${blockUuid}

> [6국03-04] {{c1 독자}}와 {{c1 매체}}를 고려하여 내용을 생성하고 표현하며 글을 쓴다.
[6국03-05] 쓰기 {{c2 과정}}을 점검·조정하며 글을 쓴다.`;
                await logseq.Editor.updateBlock(blockUuid, content);
                await expect
                    .poll(async () => (await LogseqPropertiesHelper.getBlock(blockUuid))?.content)
                    .toBe(content);

                const notes = (await ClozeNote.getNotesFromLogseqBlocks()).filter(
                    (note) => note.uuid === blockUuid
                );
                expect(notes).toHaveLength(1);
                expect(notes[0].content).toBe(content);

                const {html} = await notes[0].getClozedContentHTML();
                expect(html.match(/\{\{c[12]::.*?\}\}/g)).toEqual([
                    "{{c1::독자}}",
                    "{{c1::매체}}",
                    "{{c2::과정}}"
                ]);
                const $ = cheerio.load(html);
                expect($("h1").text().trim()).toBe("Some heading");
                expect($("blockquote").text()).toContain("[6국03-04]");
                expect($("blockquote").text()).toContain("[6국03-05]");
                expect($("li")).toHaveLength(0);
                expect(html).not.toContain("id::");
            }
        );
    });
});
