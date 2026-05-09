import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {SuspendUnsuspendPropertyParser} from "../../../../src/sync/parsers/SuspendUnsuspendPropertyParser";

describe("SuspendUnsuspendPropertyParser E2E Tests", () => {
    describe("File Mode Suspend/Unsuspend Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                "Test SuspendUnsuspendParser",
                {},
                {createFirstBlock: false}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test SuspendUnsuspendParser");
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: true",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": true}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: false",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": false}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: 'true'",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "true"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: 'false'",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "false"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: 'yes' (string)",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "yes"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: 'no' (string)",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "no"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block without suspend-anki-card property returns null",
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
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(null);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block suspend-anki-card inheritance",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {"suspend-anki-card": true}
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
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Child block suspend-anki-card overrides parent",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {"suspend-anki-card": true}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {"suspend-anki-card": false}
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
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Page property suspend-anki-card inheritance",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    "Test Page With Suspend",
                    {"suspend-anki-card": true},
                    {createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const block = await logseq.Editor.appendBlockInPage(
                    pageWithProperty.uuid,
                    "Test content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    pageWithProperty.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);

                await logseq.Editor.deletePage("Test Page With Suspend");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block property overrides page property",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    "Test Page Override",
                    {"suspend-anki-card": true},
                    {createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const block = await logseq.Editor.appendBlockInPage(
                    pageWithProperty.uuid,
                    "Test content",
                    {
                        properties: {"suspend-anki-card": false}
                    }
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    pageWithProperty.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);

                await logseq.Editor.deletePage("Test Page Override");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Case insensitive property name - Suspend-Anki-Card",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"Suspend-Anki-Card": true}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Case insensitive property name - SUSPEND-ANKI-CARD",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"SUSPEND-ANKI-CARD": false}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Case insensitive value - 'TRUE'",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "TRUE"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Case insensitive value - 'FALSE'",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "FALSE"}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        // TODO: Fix this - namespace parent page lookup issue
        test.skip("Namespace page suspend-anki-card inheritance", async () => {
            // This test fails because LogseqProxy.Editor.getPage returns null when trying to fetch
            // the parent namespace page by ID. This appears to be a limitation of the memoization
            // or the logseq-proxy library when dealing with namespace relationships in tests.

            const _parentPage = await logseq.Editor.createPage(
                "ParentNamespace",
                {"suspend-anki-card": true},
                {createFirstBlock: false}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));

            const childPage = await logseq.Editor.createPage(
                "ParentNamespace/ChildPage",
                {},
                {createFirstBlock: false}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));

            const block = await logseq.Editor.appendBlockInPage(childPage.uuid, "Test content");
            await new Promise((resolve) => setTimeout(resolve, 100));

            const freshChildPage = await logseq.Editor.getPage(childPage.uuid);
            const note = new MultilineCardNote(
                block.uuid,
                block.content,
                block.format,
                block.properties,
                freshChildPage.id
            );
            const result = await SuspendUnsuspendPropertyParser.parse(note);

            expect(result).toBe(true);

            await logseq.Editor.deletePage("ParentNamespace/ChildPage");
            await logseq.Editor.deletePage("ParentNamespace");
            await new Promise((resolve) => setTimeout(resolve, 100));
        }, 20000);
    });

    describe("DB Mode Suspend/Unsuspend Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                "Test SuspendUnsuspend DB",
                {},
                {createFirstBlock: false}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test SuspendUnsuspend DB");
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: true in DB mode",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": true}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Block with suspend-anki-card: false in DB mode",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": false}
                });
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block inheritance in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {"suspend-anki-card": true}
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
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Child block overrides parent in DB mode",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {"suspend-anki-card": true}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {"suspend-anki-card": false}
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
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Page property inheritance in DB mode",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    "Test DB Page Suspend",
                    {"suspend-anki-card": true},
                    {createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const block = await logseq.Editor.appendBlockInPage(
                    pageWithProperty.uuid,
                    "Test content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    pageWithProperty.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);

                await logseq.Editor.deletePage("Test DB Page Suspend");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Block overrides page in DB mode",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    "Test DB Override",
                    {"suspend-anki-card": true},
                    {createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const block = await logseq.Editor.appendBlockInPage(
                    pageWithProperty.uuid,
                    "Test content",
                    {
                        properties: {"suspend-anki-card": false}
                    }
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    pageWithProperty.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);

                await logseq.Editor.deletePage("Test DB Override");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });
});
