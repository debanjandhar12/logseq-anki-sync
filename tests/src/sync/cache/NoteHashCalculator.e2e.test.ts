import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {LogseqProxy} from "../../../../src/logseq/LogseqProxy";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";
import {init as initBlockPageHashCache} from "../../../../src/sync/cache/BlockAndPageHashCache";
import NoteHashCalculator from "../../../../src/sync/cache/NoteHashCalculator";
import type {ParsedNoteData} from "../../../../src/sync/types";
import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";

const filePageName = "test-note-hash";
const fileEmbedPageName = "test-embed-page-hash";
const dbPageName = "test-note-hash-db";
const dbEmbedPageName = "test-embed-page-hash-db";

const allTestPages = [filePageName, fileEmbedPageName, dbPageName, dbEmbedPageName];

const clearAllCaches = () => {
    WindowParentBridge.dispatchEvent("syncLogseqToAnkiComplete");
};

describe("NoteHashCalculator E2E Tests", () => {
    beforeAll(async () => {
        vi.spyOn(LogseqProxy.Settings, "getPluginSettings").mockReturnValue({
            disabled: false,
            defaultDeck: "Default",
            useNamespaceAsDefaultDeck: false,
            includeParentContent: false
        } as any);
        initBlockPageHashCache();
        LogseqProxy.init();
    });

    beforeEach(async () => {
        clearAllCaches();
        for (const testPageName of allTestPages) {
            await deletePagePermanently(testPageName);
        }
    }, 60_000);

    afterEach(async () => {
        for (const name of allTestPages) {
            await deletePagePermanently(name);
        }
    }, 60_000);

    describe("File Mode Hash Calculation", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                filePageName,
                {},
                {redirect: false, createFirstBlock: true}
            );
            if (!page) page = (await logseq.Editor.getPage(filePageName))!;
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
            "Hash changes when block property is removed",
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

                await logseq.Editor.removeBlockProperty(block.uuid, "deck");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in block ref changes",
            async () => {
                const referencedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Referenced content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with ref ((${referencedBlock.uuid}))`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(
                    referencedBlock.uuid,
                    "Modified referenced content"
                );
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in block embed changes",
            async () => {
                const embeddedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Embedded content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with embed {{embed ((${embeddedBlock.uuid}))}}`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embeddedBlock.uuid, "Modified embedded content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in transitive block ref changes",
            async () => {
                const blockC = await logseq.Editor.appendBlockInPage(page.uuid, "Original Block C");
                const blockB = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block B refs ((${blockC.uuid}))`
                );
                const blockA = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block A refs ((${blockB.uuid}))`
                );

                const note = new MultilineCardNote(
                    blockA.uuid,
                    blockA.content,
                    blockA.format,
                    blockA.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(blockC.uuid, "Modified Block C");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in page embed changes",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    fileEmbedPageName,
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                const embedBlock = await logseq.Editor.appendBlockInPage(
                    embedPage.uuid,
                    "Page block content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with page embed {{embed [[${fileEmbedPageName}]]}}`
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
            }
        );
    });

    describe("DB Mode Hash Calculation", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                dbPageName,
                {},
                {redirect: false, createFirstBlock: false}
            );
            if (!page) page = (await logseq.Editor.getPage(dbPageName))!;
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
            "Hash changes when block property is removed in DB mode",
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

                await logseq.Editor.removeBlockProperty(block.uuid, "deck");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in block ref changes in DB mode",
            async () => {
                const referencedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Referenced content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with ref ((${referencedBlock.uuid}))`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(
                    referencedBlock.uuid,
                    "Modified referenced content"
                );
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in block embed changes in DB mode",
            async () => {
                const embeddedBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Embedded content"
                );
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `Block with embed {{embed ((${embeddedBlock.uuid}))}}`
                );

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const hash1 = await NoteHashCalculator.getHash(note, createAnkiFields());

                await logseq.Editor.updateBlock(embeddedBlock.uuid, "Modified embedded content");
                clearAllCaches();
                const hash2 = await NoteHashCalculator.getHash(note, createAnkiFields());

                expect(hash1).not.toBe(hash2);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Hash changes when content of block in page ref changes in DB mode",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    dbEmbedPageName,
                    {},
                    {redirect: false, createFirstBlock: false}
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
            }
        );
    });
});
