import "@logseq/libs"
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {ImageOcclusionNote} from "../../../src/anki-notes/ImageOcclusionNote";
import {PageEntity} from "@logseq/libs/dist/LSPlugin";

describe("ImageOcclusionNote E2E Tests", () => {
    let page: PageEntity;
    
    beforeEach(async () => {
        page = await logseq.Editor.createPage('Test ImageOcclusionNote E2E', {}, {createFirstBlock: false});
    });

    afterEach(async () => {
        await logseq.Editor.deletePage('Test ImageOcclusionNote E2E');
    });

    test.skipIf(!globalThis.isLogseqAvailable)("Creates note with occlusion property", async () => {
        const initialNotes = await ImageOcclusionNote.getNotesFromLogseqBlocks();
        const initialCount = initialNotes.length;

        await logseq.Editor.appendBlockInPage(page.uuid, "![](../assets/image_1767261933106_0.png)", {
            properties: { 
                occlusion: "eyIuLi9hc3NldHMvaW1hZ2VfMTc2NzI2MTkzMzEwNl8wLnBuZyI6eyJjb25maWciOnt9LCJlbGVtZW50cyI6W3sibGVmdCI6NjQuMDA3ODEyNSwidG9wIjozNi45Nywid2lkdGgiOjg4LjAxNTYyNTAwMDAwMDAxLCJoZWlnaHQiOjI3Ljk0LCJhbmdsZSI6MCwiY0lkIjoxfV19fQ==" 
            }
        });

        const finalNotes = await ImageOcclusionNote.getNotesFromLogseqBlocks();
        expect(finalNotes.length).toBe(initialCount + 1);
    });
});
