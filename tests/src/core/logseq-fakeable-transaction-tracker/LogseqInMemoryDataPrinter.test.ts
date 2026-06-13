import {describe, expect, test} from "vitest";
import {
    type InMemoryBlockEntity,
    LogseqInMemoryDataPrinter
} from "../../../../src/core/logseq-fakeable-transaction-tracker";
import {createInMemoryExecutor, generateIdentities} from "./helpers/createInMemoryExecutor";

describe("LogseqInMemoryDataPrinter", () => {
    describe("print", () => {
        describe("properties and multiline content", () => {
            test("prints page properties in their own bullet and block properties with the block", async () => {
                const executor = createInMemoryExecutor();
                const [pageUuid] = generateIdentities(2);

                await executor.createPage("Test Page", {
                    category: "notes",
                    aliases: ["test-page"]
                });
                await executor.insertBlock(pageUuid, "Block content line 1\nBlock content line 2");
                const block = executor.getInMemoryPageDataDb().get(pageUuid)
                    ?.children?.[0] as InMemoryBlockEntity;
                block.properties = {
                    uuid: block.uuid,
                    tags: ["a", "b"],
                    metadata: {done: true},
                    priority: "A"
                };

                expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe(
                    [
                        "* category:: notes",
                        '  aliases:: ["test-page"]',
                        "* tags:: [[a]], [[b]]",
                        '  metadata:: {"done":true}',
                        "  priority:: A",
                        "  Block content line 1",
                        "  Block content line 2"
                    ].join("\n")
                );
            });

            test("does not print internal UUID properties", async () => {
                const executor = createInMemoryExecutor();
                const [pageUuid] = generateIdentities(2);

                await executor.createPage("Page");
                await executor.insertBlock(pageUuid, "Block");

                expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe(
                    "* Block"
                );
            });
        });

        describe("nested block trees", () => {
            test("indents each child block beneath its parent", async () => {
                const executor = createInMemoryExecutor();
                const [pageUuid, rootUuid, childUuid] = generateIdentities(4);

                await executor.createPage("Page");
                await executor.insertBlock(pageUuid, "Root");
                await executor.insertBlock(rootUuid, "Child");
                await executor.insertBlock(childUuid, "Grandchild");

                expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe(
                    ["* Root", "    * Child", "        * Grandchild"].join("\n")
                );
            });
        });

        describe("multiple pages", () => {
            test("separates page output with a blank line", async () => {
                const executor = createInMemoryExecutor();
                const [firstPageUuid, , secondPageUuid] = generateIdentities(4);

                await executor.createPage("First");
                await executor.insertBlock(firstPageUuid, "First block");
                await executor.createPage("Second");
                await executor.insertBlock(secondPageUuid, "Second block");

                expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe(
                    ["* First block", "", "* Second block"].join("\n")
                );
            });
        });

        describe("empty databases", () => {
            test("prints an empty string", () => {
                expect(LogseqInMemoryDataPrinter.print(new Map())).toBe("");
            });
        });

        test("prints readable tags and metadata sections when metadata is supplied", async () => {
            const executor = createInMemoryExecutor();
            const [pageUuid, blockUuid] = generateIdentities(2);
            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Book block");
            await executor.createTag("Book", {
                tagProperties: [{name: "rating", schema: {type: "number"}}]
            });
            await executor.addBlockTag(blockUuid, "Book");

            expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe(
                [
                    "* tags:: [[Book]]",
                    "  Book block",
                    "",
                    "Properties",
                    "* rating",
                    "  type:: number",
                    "",
                    "Tags",
                    "* Book",
                    "  properties:: rating"
                ].join("\n")
            );
        });
    });
});
