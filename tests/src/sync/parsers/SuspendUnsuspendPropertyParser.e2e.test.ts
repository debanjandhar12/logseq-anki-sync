import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {SuspendUnsuspendPropertyParser} from "../../../../src/sync/parsers/SuspendUnsuspendPropertyParser";
import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";

const pageName = "test-suspend-unsuspend-parser";
const pageWithSuspendName = "test-page-with-suspend";
const pageOverrideName = "test-page-override";
const parentNamespacePageName = "ParentNamespace";
const childNamespacePageName = "ParentNamespace/ChildPage";
const dbPageName = "test-suspend-unsuspend-db";
const dbPageWithSuspendName = "test-db-page-suspend";
const dbPageOverrideName = "test-db-override";

const allTestPages = [
    pageName,
    pageWithSuspendName,
    pageOverrideName,
    parentNamespacePageName,
    childNamespacePageName,
    dbPageName,
    dbPageWithSuspendName,
    dbPageOverrideName
];

describe("SuspendUnsuspendPropertyParser E2E Tests", () => {
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

    describe("File Mode Suspend/Unsuspend Resolution", () => {
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
            "Block with suspend-anki-card: 'true' (string)",
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
            "Block with suspend-anki-card: 'false' (string)",
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
            "Parent block inheritance - true",
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
            "Parent block inheritance - false",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {"suspend-anki-card": false}
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

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Grandparent block inheritance",
            async () => {
                const grandparent = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Grandparent content",
                    {
                        properties: {"suspend-anki-card": true}
                    }
                );
                const parent = await logseq.Editor.insertBlock(grandparent.uuid, "Parent content");
                const child = await logseq.Editor.insertBlock(parent.uuid, "Child content");
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    child.uuid,
                    child.content,
                    child.format,
                    child.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(true);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Child overrides parent block",
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
            "Parent overrides grandparent block",
            async () => {
                const grandparent = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Grandparent content",
                    {
                        properties: {"suspend-anki-card": true}
                    }
                );
                const parent = await logseq.Editor.insertBlock(grandparent.uuid, "Parent content", {
                    properties: {"suspend-anki-card": false}
                });
                const child = await logseq.Editor.insertBlock(parent.uuid, "Child content");
                await new Promise((resolve) => setTimeout(resolve, 100));

                const note = new MultilineCardNote(
                    child.uuid,
                    child.content,
                    child.format,
                    child.properties,
                    page.id
                );
                const result = await SuspendUnsuspendPropertyParser.parse(note);

                expect(result).toBe(false);
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Leaves suspension unchanged when no property is present",
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

                expect(result).toBeNull();
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Page property suspend-anki-card inheritance",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    pageWithSuspendName,
                    {"suspend-anki-card": true},
                    {redirect: false, createFirstBlock: true}
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

                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block property overrides page property",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    pageOverrideName,
                    {"suspend-anki-card": true},
                    {redirect: false, createFirstBlock: true}
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
            "Invalid boolean string leaves suspension unchanged",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": "invalid"}
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

                expect(result).toBeNull();
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Non-boolean/string value leaves suspension unchanged",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {"suspend-anki-card": 123}
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

                expect(result).toBeNull();
            }
        );

        // TODO: Fix this
        test.skip("Namespace page suspend inheritance", async () => {
            await logseq.Editor.createPage(
                parentNamespacePageName,
                {"suspend-anki-card": true},
                {redirect: false, createFirstBlock: true}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));

            const childPage = await logseq.Editor.createPage(
                childNamespacePageName,
                {},
                {redirect: false, createFirstBlock: true}
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

            await new Promise((resolve) => setTimeout(resolve, 100));
        }, 20000);
    });

    describe("DB Mode Suspend/Unsuspend Resolution", () => {
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
            "Child block overrides parent block in DB mode",
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
                    dbPageWithSuspendName,
                    {"suspend-anki-card": true},
                    {redirect: false, createFirstBlock: true}
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

                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Block overrides page in DB mode",
            async () => {
                const pageWithProperty = await logseq.Editor.createPage(
                    dbPageOverrideName,
                    {"suspend-anki-card": true},
                    {redirect: false, createFirstBlock: true}
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

                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });
});
