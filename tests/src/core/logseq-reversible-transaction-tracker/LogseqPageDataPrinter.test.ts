import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {LogseqPageDataPrinter} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {LogseqPropertiesHelper} from "../../../../src/logseq/LogseqPropertiesHelper";

vi.mock("../../../../src/logseq/LogseqPropertiesHelper", () => ({
    LogseqPropertiesHelper: {
        getPage: vi.fn(),
        getPageBlocksTree: vi.fn()
    }
}));

const getPage = vi.mocked(LogseqPropertiesHelper.getPage);
const getPageBlocksTree = vi.mocked(LogseqPropertiesHelper.getPageBlocksTree);

function page(overrides: Partial<PageEntity> = {}): PageEntity {
    return {
        uuid: "page-uuid",
        name: "test page",
        originalName: "Test Page",
        properties: {},
        ...overrides
    } as PageEntity;
}

function block(overrides: Partial<BlockEntity> = {}): BlockEntity {
    return {
        uuid: "block-uuid",
        content: "Block content",
        properties: {},
        children: [],
        ...overrides
    } as BlockEntity;
}

describe("LogseqPageDataPrinter", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    test("prints a resolved page only once when multiple identities point to it", async () => {
        getPage.mockResolvedValue(
            page({uuid: "page-uuid", name: "hello worldxs29", originalName: "hello worldxs29"})
        );
        getPageBlocksTree.mockResolvedValue([
            block({uuid: "parent-uuid", content: "Parent Block"})
        ]);

        const printedPages = await LogseqPageDataPrinter.print([
            "hello worldxs29",
            {uuid: "page-uuid"} as PageEntity
        ]);

        expect(printedPages).toBe(`# hello worldxs29
* Parent Block`);
        expect(getPage).toHaveBeenCalledTimes(2);
        expect(getPageBlocksTree).toHaveBeenCalledTimes(1);
    });

    test("prints soft deleted pages as blank pages", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(
            page({
                name: "hello worldxs29",
                originalName: "hello worldxs29",
                properties: {
                    uuid: "page-uuid",
                    ":block/tags": ["Page"],
                    ":logseq.property/deleted-at": 1783059479739,
                    ":logseq.property.recycle/original-page": "Hello WorldXS29"
                },
                [":logseq.property/deleted-at" as keyof PageEntity]: 1783059479739
            }),
            [block({content: "Deleted page block"})]
        );

        expect(printedPage).toBe("# hello worldxs29");
    });

    test("prints a nested page block tree once", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(page(), [
            block({
                uuid: "parent-uuid",
                content: "Parent",
                children: [
                    block({
                        uuid: "child-uuid",
                        content: "Child",
                        children: [block({uuid: "grandchild-uuid", content: "Grandchild"})]
                    })
                ]
            })
        ]);

        expect(printedPage).toBe(`# Test Page
* Parent
    * Child
        * Grandchild`);
    });

    test("does not treat nested children as duplicate root blocks", () => {
        const child = block({uuid: "child-uuid", content: "Child"});
        const printedPage = LogseqPageDataPrinter.printPageTree(page(), [
            block({uuid: "parent-uuid", content: "Parent", children: [child]}),
            block({uuid: "sibling-uuid", content: "Sibling"})
        ]);

        expect(printedPage).toBe(`# Test Page
* Parent
    * Child
* Sibling`);
    });

    test("prints page and block properties before content", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(
            page({properties: {uuid: "page-uuid", alias: ["Alias"]}}),
            [
                block({
                    content: "Block content",
                    properties: {uuid: "block-uuid", priority: "high"}
                })
            ]
        );

        expect(printedPage).toBe(`# Test Page
* alias:: ["Alias"]
* priority:: high
  Block content`);
    });

    test("uses title when content is absent", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(page(), [
            block({content: undefined, title: "Title content"})
        ]);

        expect(printedPage).toBe(`# Test Page
* Title content`);
    });
});
