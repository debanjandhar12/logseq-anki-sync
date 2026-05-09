import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {LogseqProxy} from "../../../../src/logseq/LogseqProxy";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";
import {init as initBlockPageHashCache} from "../../../../src/sync/cache/BlockAndPageHashCache";
import NoteHashCalculator from "../../../../src/sync/cache/NoteHashCalculator";
import type {ParsedNoteData} from "../../../../src/sync/types";

// Mock settings
vi.mock("../../../../src/logseq/LogseqProxy", async () => {
    const actual = await vi.importActual<typeof import("../../../../src/logseq/LogseqProxy")>(
        "../../../../src/logseq/LogseqProxy"
    );
    return {
        ...actual,
        LogseqProxy: {
            ...actual.LogseqProxy,
            Settings: {
                getPluginSettings: () => ({
                    defaultDeck: "Default",
                    useNamespaceAsDefaultDeck: false,
                    includeParentContent: false
                })
            }
        }
    };
});

beforeAll(() => {
    // Mock logseq event handlers not available in test proxy
    logseq.onSettingsChanged = vi.fn();
    logseq.App.onCurrentGraphChanged = vi.fn();
    logseq.beforeunload = vi.fn();

    initBlockPageHashCache();
    LogseqProxy.init();
});

const clearAllCaches = () => {
    WindowParentBridge.dispatchEvent("syncLogseqToAnkiComplete");
};

describe("NoteHashCalculator E2E Tests", () => {
    describe("File Mode Hash Calculation", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage("Test NoteHash", {}, {createFirstBlock: false});
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test NoteHash");
        });

        const createAnkiFields = (): ParsedNoteData => ["", new Set<string>(), "", "", []];

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when block content is changed",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Original content");

                let note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(block.uuid, "Modified content");
                clearAllCaches();

                const updatedBlock = await logseq.Editor.getBlock(block.uuid);
                note = new MultilineCardNote(
                    updatedBlock.uuid,
                    updatedBlock.content,
                    updatedBlock.format,
                    updatedBlock.properties,
                    page.id
                );
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when block property is changed",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {deck: "Deck1"}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.upsertBlockProperty(block.uuid, "deck", "Deck2");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when tag is added to block",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content");

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.upsertBlockProperty(block.uuid, "tags", "newtag");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block ref changes",
            async () => {
                const refBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Referenced content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with ref ((${refBlock.uuid}))`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(refBlock.uuid, "Modified referenced content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block embed changes",
            async () => {
                const embedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Embedded content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with embed {{embed ((${embedBlock.uuid}))}}`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embedBlock.uuid, "Modified embedded content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in page embed changes",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    "Test Embed Page Hash",
                    {},
                    {createFirstBlock: false}
                );
                const embedBlock = await logseq.Editor.appendBlockInPage(
                    embedPage.uuid,
                    "Page block content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with page embed {{embed [[Test Embed Page Hash]]}}`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embedBlock.uuid, "Modified page block content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);

                await logseq.Editor.deletePage("Test Embed Page Hash");
            }
        );

        // This case currently fails since logseq does not update page props imediately after upsertBlockProperty
        // test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)("Hash changes when page property in page embed changes", async () => {
        // TODO: Implement similar to db case
        // });
    });

    describe("DB Mode Hash Calculation", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                "Test NoteHash DB",
                {},
                {createFirstBlock: false}
            );
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test NoteHash DB");
        });

        const createAnkiFields = (): ParsedNoteData => ["", new Set<string>(), "", "", []];

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when block content is changed in DB mode",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Original content");

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(block.uuid, "Modified content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when block property is changed in DB mode",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {deck: "Deck1"}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.upsertBlockProperty(block.uuid, "deck", "Deck2");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when tag is added to block in DB mode",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content");

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.upsertBlockProperty(block.uuid, "tags", "newtag");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block ref changes in DB mode",
            async () => {
                const refBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Referenced content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with ref [[${refBlock.uuid}]]`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(refBlock.uuid, "Modified referenced content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block embed changes in DB mode",
            async () => {
                const embedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Embedded content"
                );
                const block = await logseq.Editor.appendBlockInPage(page.uuid, ``, {
                    properties: {link: embedBlock.id}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embedBlock.uuid, "Modified embedded content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in page ref changes in DB mode",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    "Test Embed Page Hash DB",
                    {},
                    {createFirstBlock: false}
                );
                const embedBlock = await logseq.Editor.appendBlockInPage(
                    embedPage.uuid,
                    "Page block content"
                );
                const block = await logseq.Editor.appendBlockInPage(page.uuid, ``, {
                    properties: {link: embedPage.id}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embedBlock.uuid, "Modified page block content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);

                await logseq.Editor.deletePage("Test Embed Page Hash DB");
            }
        );

        // This case currently fails since logseq does not update page props imediately after upsertBlockProperty
        // test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)("Hash changes when page property in page ref changes in DB mode", async () => {
        //     const embedPage = await logseq.Editor.createPage('Test Embed Page Prop DB', null, { createFirstBlock: false });
        //     const blockPropForEmbedPage = await logseq.Editor.appendBlockInPage(page.uuid, ``, { properties:{ prop: "value1" } });
        //     const block = await logseq.Editor.appendBlockInPage(page.uuid, ``, { properties:{link: embedPage.id} });
        //
        //     const note = new MultilineCardNote(block.uuid, block.content, block.format, block.properties, page.id);
        //     const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());
        //     await logseq.Editor.upsertBlockProperty(blockPropForEmbedPage.uuid, "prop", "value2");
        //     clearAllCaches();
        //     const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());
        //
        //     expect(hash1).not.toBe(hash2);
        //
        //     await logseq.Editor.deletePage('Test Embed Page Prop DB');
        // });
    });
});
