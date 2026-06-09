import {describe, expect, test} from "vitest";
import {
    type InMemoryBlockEntity,
    type InMemoryDB,
    type InMemoryPageEntity,
    LogseqInMemoryDataPrinter
} from "../../../../src/core/logseq-fakeable-transaction-tracker";

describe("LogseqInMemoryDataPrinter", () => {
    describe("print", () => {
        describe("properties and multiline content", () => {
            test("prints page properties in their own bullet and block properties with the block", () => {
                const block = createBlock("block-1", "Block content line 1\nBlock content line 2", {
                    uuid: "block-1",
                    tags: ["a", "b"],
                    metadata: {done: true},
                    priority: "A"
                });
                const page = createPage("page-1", "Test Page", [block], {
                    uuid: "page-1",
                    category: "notes",
                    aliases: ["test-page"]
                });

                expect(printPages(page)).toBe(
                    [
                        "* category:: notes",
                        '  aliases:: ["test-page"]',
                        '* tags:: ["a","b"]',
                        '  metadata:: {"done":true}',
                        "  priority:: A",
                        "  Block content line 1",
                        "  Block content line 2"
                    ].join("\n")
                );
            });

            test("does not print internal UUID properties", () => {
                const block = createBlock("block-1", "Block", {uuid: "block-1"});
                const page = createPage("page-1", "Page", [block], {uuid: "page-1"});

                expect(printPages(page)).toBe("* Block");
            });
        });

        describe("nested block trees", () => {
            test("indents each child block beneath its parent", () => {
                const grandchild = createBlock("grandchild", "Grandchild");
                const child = createBlock("child", "Child", {}, [grandchild]);
                const root = createBlock("root", "Root", {}, [child]);

                expect(printPages(createPage("page", "Page", [root]))).toBe(
                    ["* Root", "    * Child", "        * Grandchild"].join("\n")
                );
            });
        });

        describe("multiple pages", () => {
            test("separates page output with a blank line", () => {
                const firstPage = createPage("page-1", "First", [
                    createBlock("block-1", "First block")
                ]);
                const secondPage = createPage("page-2", "Second", [
                    createBlock("block-2", "Second block")
                ]);

                expect(printPages(firstPage, secondPage)).toBe(
                    ["* First block", "", "* Second block"].join("\n")
                );
            });
        });

        describe("empty databases", () => {
            test("prints an empty string", () => {
                expect(LogseqInMemoryDataPrinter.print(new Map())).toBe("");
            });
        });
    });
});

function printPages(...pages: InMemoryPageEntity[]): string {
    const db: InMemoryDB = new Map(pages.map((page) => [page.uuid, page]));
    return LogseqInMemoryDataPrinter.print(db);
}

function createPage(
    uuid: string,
    name: string,
    children: InMemoryBlockEntity[] = [],
    properties: Record<string, unknown> = {}
): InMemoryPageEntity {
    return {
        uuid,
        type: "page",
        name,
        title: name,
        fullTitle: name,
        content: name,
        format: "markdown",
        createdAt: 1,
        updatedAt: 1,
        "journal?": false,
        properties,
        children
    };
}

function createBlock(
    uuid: string,
    content: string,
    properties: Record<string, unknown> = {},
    children: InMemoryBlockEntity[] = []
): InMemoryBlockEntity {
    return {
        uuid,
        type: "block",
        content,
        title: content,
        fullTitle: content,
        format: "markdown",
        createdAt: 1,
        updatedAt: 1,
        properties,
        children
    };
}
