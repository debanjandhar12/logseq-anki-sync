import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {LogseqProxy} from "../../../../src/logseq/LogseqProxy";
import {TagParser} from "../../../../src/sync/parsers/TagParser";
import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";

const pageName = "test-tag-parser";
const parentNamespacePageTag = "ParentNamespacePageTag";
const childNamespacePageTag = "ParentNamespacePageTag/ChildPage";

const allTestPages = [pageName, parentNamespacePageTag, childNamespacePageTag];

describe("TagParser E2E Tests", () => {
    beforeAll(async () => {
        vi.spyOn(LogseqProxy.Settings, "getPluginSettings").mockReturnValue({
            disabled: false,
            defaultDeck: "Default",
            useNamespaceAsDefaultDeck: false
        } as any);
    });

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

    describe("File Mode Tag Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: true}
            );
            if (!page) page = (await logseq.Editor.getPage(pageName))!;
        });

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with tags property and initial tags",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {tags: "Hello,World"}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const tags = await TagParser.parse(note, ["Hello", "Anki"]);

                expect(tags).toHaveLength(3);
                expect(tags).toContain("Hello");
                expect(tags).toContain("World");
                expect(tags).toContain("Anki");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Block with tags property without initial tags",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(page.uuid, "Test content", {
                    properties: {tags: "Hello,World"}
                });

                const note = new MultilineCardNote(
                    block.uuid,
                    block.content,
                    block.format,
                    block.properties,
                    page.id
                );
                const tags = await TagParser.parse(note, []);

                expect(tags).toHaveLength(2);
                expect(tags).toContain("Hello");
                expect(tags).toContain("World");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Parent block tags inheritance",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {tags: "ParentTag"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content"
                );

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const tags = await TagParser.parse(note, []);

                expect(tags).toHaveLength(1);
                expect(tags).toContain("ParentTag");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Multiple parent blocks tags inheritance",
            async () => {
                const grandparent = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Grandparent content",
                    {
                        properties: {tags: "Grandparent"}
                    }
                );
                const parent = await logseq.Editor.insertBlock(grandparent.uuid, "Parent content", {
                    properties: {tags: "Parent"}
                });
                const child = await logseq.Editor.insertBlock(parent.uuid, "Child content", {
                    properties: {tags: "Child"}
                });

                const note = new MultilineCardNote(
                    child.uuid,
                    child.content,
                    child.format,
                    child.properties,
                    page.id
                );
                const tags = await TagParser.parse(note, []);

                expect(tags).toHaveLength(3);
                expect(tags).toContain("Grandparent");
                expect(tags).toContain("Parent");
                expect(tags).toContain("Child");
            }
        );

        test.skip("Namespace page tags and child page block tags - LogseqProxy.Editor.getPage returns null for namespace parent", async () => {
            // Create parent namespace page with tags
            await logseq.Editor.createPage(
                parentNamespacePageTag,
                {tags: "Parent"},
                {redirect: false, createFirstBlock: true}
            );

            // Wait for namespace to be established
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Create child page in namespace
            const childPage = await logseq.Editor.createPage(
                childNamespacePageTag,
                {},
                {redirect: false, createFirstBlock: true}
            );

            // Wait for namespace relationship
            await new Promise((resolve) => setTimeout(resolve, 100));

            const block = await logseq.Editor.appendBlockInPage(childPage.uuid, "Test content", {
                properties: {tags: "Anki"}
            });

            const freshChildPage = await logseq.Editor.getPage(childPage.uuid);
            const note = new MultilineCardNote(
                block.uuid,
                block.content,
                block.format,
                block.properties,
                freshChildPage.id
            );
            const tags = await TagParser.parse(note, []);

            expect(tags).toHaveLength(2);
            expect(tags).toContain("Parent");
            expect(tags).toContain("Anki");

            // Cleanup
        }, 20000);
    });
});
