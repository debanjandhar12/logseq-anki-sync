import "@logseq/libs"
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import { ExtraFieldParser } from "../../../../src/sync/parsers/ExtraFieldParser";
import { MultilineCardNote } from "../../../../src/anki-notes/MultilineCardNote";
import {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";

// Mock settings
vi.mock('../../../../src/logseq/LogseqProxy', async () => {
    const actual = await vi.importActual<typeof import('../../../../src/logseq/LogseqProxy')>('../../../../src/logseq/LogseqProxy');
    return {
        ...actual,
        LogseqProxy: {
            ...actual.LogseqProxy,
            Settings: {
                getPluginSettings: () => ({
                    defaultDeck: 'Default',
                    useNamespaceAsDefaultDeck: false
                })
            }
        }
    };
});

describe("ExtraFieldParser E2E Tests", () => {
    describe("File Mode Extra Field Resolution", () => {
        let prevPage: PageEntity | BlockEntity, page: PageEntity;
        
        beforeEach(async () => {
            prevPage = await logseq.Editor.getCurrentPage();
            page = await logseq.Editor.createPage('Test ExtraFieldParser', {}, {createFirstBlock: false});
        });

        afterEach(async () => {
            await logseq.Editor.deletePage('Test ExtraFieldParser');
        });

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)("Block with extra property", async () => {
            const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                properties: { extra: "Extra **bold** content" }
            });
            
            const note = new MultilineCardNote(block.uuid, block.content, block.format, block.properties, page);
            const assets = new Set<string>();
            const extra = await ExtraFieldParser.parse(note, assets);
            
            expect(extra).toContain("Extra");
            expect(extra).toContain("<b>bold</b>");
            expect(extra).toContain("content");
        });
    });
});
