import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {MultilineCardNote} from "../../../../src/anki-notes/MultilineCardNote";
import {TagParser} from "../../../../src/sync/parsers/TagParser";

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
                    useNamespaceAsDefaultDeck: false
                })
            }
        }
    };
});

describe("TagParser E2E Tests", () => {
    describe("File Mode Tag Resolution", () => {
        let page: PageEntity;

        beforeEach(async () => {
            page = await logseq.Editor.createPage("Test TagParser", {}, {createFirstBlock: false});
        });

        afterEach(async () => {
            await logseq.Editor.deletePage("Test TagParser");
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
            "Parent block tags and child block tags",
            async () => {
                const parentBlock = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Parent content",
                    {
                        properties: {tags: "Hello,World"}
                    }
                );
                const childBlock = await logseq.Editor.insertBlock(
                    parentBlock.uuid,
                    "Child content",
                    {
                        properties: {tags: "Anki"}
                    }
                );

                const note = new MultilineCardNote(
                    childBlock.uuid,
                    childBlock.content,
                    childBlock.format,
                    childBlock.properties,
                    page.id
                );
                const tags = await TagParser.parse(note, []);

                expect(tags).toHaveLength(3);
                expect(tags).toContain("Hello");
                expect(tags).toContain("World");
                expect(tags).toContain("Anki");
            }
        );

        test.skip("Namespace page tags and child page block tags - LogseqProxy.Editor.getPage returns null for namespace parent", async () => {
            // This test fails because LogseqProxy.Editor.getPage returns null when trying to fetch
            // the parent namespace page by ID. This appears to be a limitation of the memoization
            // or the logseq-proxy library when dealing with namespace relationships in tests.

            // Create parent namespace page with tags
            await logseq.Editor.createPage(
                "ParentNamespacePageTag",
                {tags: "Parent"},
                {createFirstBlock: false}
            );

            // Wait for namespace to be established
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Create child page in namespace
            const childPage = await logseq.Editor.createPage(
                "ParentNamespacePageTag/ChildPage",
                {},
                {createFirstBlock: false}
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
            await logseq.Editor.deletePage("ParentNamespacePageTag/ChildPage");
            await logseq.Editor.deletePage("ParentNamespacePageTag");
        }, 20000);
    });
});
