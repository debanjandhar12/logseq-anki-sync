import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {DeckParser} from "../../../../src/sync/parsers/DeckParser";
import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";

const pageName = "test-deck-parser";
const japanPageName = "Geography/Japan";
const parentNamespacePageName = "ParentNamespacePage";
const childNamespacePageName = "ParentNamespacePage/ChildPage";
const dbPageName = "test-deck-parser-db";

const allTestPages = [
    pageName,
    japanPageName,
    parentNamespacePageName,
    childNamespacePageName,
    dbPageName
];

describe("DeckParser E2E Tests", () => {
    beforeEach(async () => {
        for (const testPageName of allTestPages) {
            await deletePagePermanently(testPageName);
        }
    }, 60_000);

    afterEach(async () => {
        for (const name of allTestPages) {
            await deletePagePermanently(name);
        }
    }, 60_000);

    describe("File Mode Deck Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: true}
            );
            if (!page) page = (await logseq.Editor.getPage(pageName))!;
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with deck property [[Parent Deck/Child Deck]] format",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {deck: "[[Parent Deck/Child Deck]]"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("Parent Deck::Child Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with deck property Parent Deck/Child Deck format",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {deck: "Parent Deck/Child Deck"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("Parent Deck::Child Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with simple deck property",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {deck: "SimpleDeck"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("SimpleDeck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block deck inheritance",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "ParentDeck"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("ParentDeck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block deck inheritance with [[Parent/Child]] format",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "[[Parent/Child]]"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("Parent::Child");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Child block deck overrides parent block deck",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "ParentDeck"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {deck: "ChildDeck"}
                    }
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("ChildDeck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Default to current page name when no deck property",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content");
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe(pageName);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Default to current page name with namespace",
            async () => {
                const namespacedPage = await logseq.Editor.createPage(
                    japanPageName,
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                const block = await logseq.Editor.appendBlockInPage(
                    namespacedPage.uuid,
                    "Test content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    namespacedPage.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("Geography::Japan");

                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        // TODO: Fix this
        test.skip("Namespace page deck inheritance - LogseqProxy.Editor.getPage returns null for namespace parent", async () => {
            // Create parent namespace page with deck property
            await logseq.Editor.createPage(
                parentNamespacePageName,
                {deck: "Parent Namespaced Page"},
                {redirect: false, createFirstBlock: true}
            );

            // Wait a bit for namespace to be established
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Create child page in namespace
            const childPage = await logseq.Editor.createPage(
                childNamespacePageName,
                {},
                {redirect: false, createFirstBlock: true}
            );

            // Wait for namespace relationship to be established
            await new Promise((resolve) => setTimeout(resolve, 100));

            const block = await logseq.Editor.appendBlockInPage(childPage.uuid, "Test content");
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Refresh childPage to get namespace info
            const freshChildPage = await logseq.Editor.getPage(childPage.uuid);

            const note = new MultilineCardNote(
                block.uuid,
                block.content,
                block.format,
                block.properties,
                freshChildPage.id
            );
            const deck = await DeckParser.parse(note);

            expect(deck).toBe("Parent Namespaced Page");

            await new Promise((resolve) => setTimeout(resolve, 100));
        }, 20000);
    });

    describe("DB Mode Deck Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                dbPageName,
                {},
                {redirect: false, createFirstBlock: true}
            );
            if (!page) page = (await logseq.Editor.getPage(dbPageName))!;
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block deck inheritance in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "ParentDeck"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("ParentDeck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Child block deck overrides parent block deck in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "ParentDeck"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {deck: "ChildDeck"}
                    }
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const deck = await DeckParser.parse(note);

                expect(deck).toBe("ChildDeck");
            }
        );
    });
});
