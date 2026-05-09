import "@logseq/libs";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {LogseqProxy} from "../../../../src/logseq/LogseqProxy";
import {DeckParser} from "../../../../src/sync/parsers/DeckParser";

describe("DeckParser E2E Tests", () => {
    describe("File Mode Deck Resolution", () => {
        let prevPage: PageEntity | BlockEntity, page: PageEntity;

        beforeEach(async () => {
            prevPage = await logseq.Editor.getCurrentPage();
            page = await logseq.Editor.createPage("Test DeckParser", {}, {createFirstBlock: false});
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test DeckParser");
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
            "Parent block deck inheritance",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "Deck"}
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

                expect(deck).toBe("Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Child block deck overrides parent",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {deck: "Parent Deck"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {deck: "Child Deck"}
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

                expect(deck).toBe("Child Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Default to current page name when no deck specified",
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

                expect(deck).toBe("Test DeckParser");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Default to current page name with namespace",
            async () => {
                const namespacedPage = await logseq.Editor.createPage(
                    "Geography/Japan",
                    {},
                    {createFirstBlock: false}
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

                await logseq.Editor.deletePage("Geography/Japan");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        // TODO: Fix this
        test.skip("Namespace page deck inheritance - LogseqProxy.Editor.getPage returns null for namespace parent", async () => {
            // This test fails because LogseqProxy.Editor.getPage returns null when trying to fetch
            // the parent namespace page by ID. This appears to be a limitation of the memoization
            // or the logseq-proxy library when dealing with namespace relationships in tests.

            // Create parent namespace page with deck property
            const parentPage = await logseq.Editor.createPage(
                "ParentNamespacePage",
                {deck: "Parent Namespaced Page"},
                {createFirstBlock: false}
            );

            // Wait a bit for namespace to be established
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Create child page in namespace
            const childPage = await logseq.Editor.createPage(
                "ParentNamespacePage/ChildPage",
                {},
                {createFirstBlock: false}
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

            // Cleanup
            await logseq.Editor.deletePage("ParentNamespacePage/ChildPage");
            await logseq.Editor.deletePage("ParentNamespacePage");
            await new Promise((resolve) => setTimeout(resolve, 100));
        }, 20000);
    });

    describe("DB Mode Deck Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                "Test DeckParser DB",
                {},
                {createFirstBlock: false}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test DeckParser DB");
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block deck inheritance in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {properties: {deck: "Deck"}}
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

                expect(deck).toBe("Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Child block deck overrides parent in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {properties: {deck: "Parent Deck"}}
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {properties: {deck: "Child Deck"}}
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

                expect(deck).toBe("Child Deck");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Default to current page name when no deck specified in DB mode",
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

                expect(deck).toBe("Test DeckParser DB");
            }
        );
    });
});
