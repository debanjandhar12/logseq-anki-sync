import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {
    LogseqPageDataPrinter,
    type LogseqPrintedPageSnapshot,
    NON_EXISTENT_PAGE_NAME
} from "../../../../src/core/logseq-reversible-transaction-tracker";
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

function snapshot(overrides: Partial<LogseqPrintedPageSnapshot> = {}): LogseqPrintedPageSnapshot {
    return {
        identityKey: "page-uuid",
        resolvedPageUuid: "page-uuid",
        exists: true,
        pageName: "Test Page",
        content: "* Block content",
        ...overrides
    };
}

describe("LogseqPageDataPrinter", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    test("returns ordered snapshots and caches pages resolved by multiple identities", async () => {
        getPage.mockResolvedValue(
            page({uuid: "page-uuid", name: "hello world", originalName: "Hello World"})
        );
        getPageBlocksTree.mockResolvedValue([block({content: "Parent Block"})]);

        const printedPages = await LogseqPageDataPrinter.print([
            "hello world",
            {uuid: "page-uuid"} as PageEntity
        ]);

        expect(printedPages).toEqual([
            {
                identityKey: "hello world",
                resolvedPageUuid: "page-uuid",
                exists: true,
                pageName: "Hello World",
                content: "* Parent Block"
            },
            {
                identityKey: "page-uuid",
                resolvedPageUuid: "page-uuid",
                exists: true,
                pageName: "Hello World",
                content: "* Parent Block"
            }
        ]);
        expect(getPage).toHaveBeenCalledTimes(2);
        expect(getPageBlocksTree).toHaveBeenCalledOnce();
    });

    test("represents unresolved and soft-deleted pages as nonexistent", async () => {
        getPage.mockResolvedValueOnce(null).mockResolvedValueOnce(
            page({
                uuid: "deleted-uuid",
                [":logseq.property/deleted-at" as keyof PageEntity]: 1783059479739
            })
        );

        const printedPages = await LogseqPageDataPrinter.print(["missing", "deleted-uuid"]);

        expect(printedPages).toEqual([
            {
                identityKey: "missing",
                resolvedPageUuid: null,
                exists: false,
                pageName: NON_EXISTENT_PAGE_NAME,
                content: ""
            },
            {
                identityKey: "deleted-uuid",
                resolvedPageUuid: "deleted-uuid",
                exists: false,
                pageName: NON_EXISTENT_PAGE_NAME,
                content: ""
            }
        ]);
        expect(getPageBlocksTree).not.toHaveBeenCalled();
    });

    test("prints page and block properties before heading-free content", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(
            page({properties: {uuid: "page-uuid", alias: ["Alias"]}}),
            [
                block({
                    content: "Block content",
                    properties: {uuid: "block-uuid", priority: "high"}
                })
            ]
        );

        expect(printedPage).toBe(`* alias:: ["Alias"]
* priority:: high
  Block content`);
    });

    test("indents multiline page and nested block properties", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(
            page({properties: {apple: "line 1\r\nline 2"}}),
            [
                block({
                    content: "Parent line 1\nParent line 2",
                    properties: {description: "property line 1\nproperty line 2"},
                    children: [
                        block({
                            content: "Child",
                            properties: {description: "child line 1\nchild line 2"}
                        })
                    ]
                })
            ]
        );

        expect(printedPage).toBe(`* apple:: line 1
  line 2
* description:: property line 1
  property line 2
  Parent line 1
  Parent line 2
    * description:: child line 1
      child line 2
      Child`);
    });

    test("prints nested blocks once and uses title when content is absent", () => {
        const printedPage = LogseqPageDataPrinter.printPageTree(page(), [
            block({
                content: undefined,
                title: "Parent",
                children: [block({content: "Child"})]
            })
        ]);

        expect(printedPage).toBe(`* Parent
    * Child`);
    });
});

describe("LogseqPageDataPrinter.createChanges", () => {
    test("keeps ordinary edits and removes unchanged pages", () => {
        const changes = LogseqPageDataPrinter.createChanges(
            [snapshot({content: "* Before"}), snapshot({resolvedPageUuid: "same"})],
            [snapshot({content: "* After"}), snapshot({resolvedPageUuid: "same"})]
        );

        expect(changes).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: "Test Page", content: "* Before"},
                after: {pageName: "Test Page", content: "* After"}
            }
        ]);
    });

    test("collapses rename aliases into one ordered page change", () => {
        const changes = LogseqPageDataPrinter.createChanges(
            [
                snapshot({identityKey: "page-uuid", pageName: "Old Name"}),
                snapshot({
                    identityKey: "new name",
                    resolvedPageUuid: null,
                    exists: false,
                    pageName: NON_EXISTENT_PAGE_NAME,
                    content: ""
                })
            ],
            [
                snapshot({identityKey: "page-uuid", pageName: "New Name"}),
                snapshot({identityKey: "new name", pageName: "New Name"})
            ]
        );

        expect(changes).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: "Old Name", content: "* Block content"},
                after: {pageName: "New Name", content: "* Block content"}
            }
        ]);
    });

    test("collapses transitive aliases and preserves first-seen page order", () => {
        const changes = LogseqPageDataPrinter.createChanges(
            [
                snapshot({resolvedPageUuid: "first", pageName: "First Before"}),
                snapshot({resolvedPageUuid: "second", pageName: "Second", content: "* Old"}),
                snapshot({resolvedPageUuid: null, exists: false}),
                snapshot({resolvedPageUuid: "first", pageName: "First Before"})
            ],
            [
                snapshot({resolvedPageUuid: "first", pageName: "First After"}),
                snapshot({resolvedPageUuid: "second", pageName: "Second", content: "* New"}),
                snapshot({resolvedPageUuid: "first", pageName: "First After"}),
                snapshot({resolvedPageUuid: "third", pageName: "First After"})
            ]
        );

        expect(changes.map(({key, before, after}) => ({key, before, after}))).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: "First Before", content: "* Block content"},
                after: {pageName: "First After", content: "* Block content"}
            },
            {
                key: "changed-page-1",
                before: {pageName: "Second", content: "* Old"},
                after: {pageName: "Second", content: "* New"}
            }
        ]);
    });

    test.each([
        {
            label: "created",
            before: snapshot({exists: false, pageName: NON_EXISTENT_PAGE_NAME, content: ""}),
            after: snapshot({pageName: "Created Page"}),
            expectedBefore: {pageName: NON_EXISTENT_PAGE_NAME, content: ""},
            expectedAfter: {pageName: "Created Page", content: "* Block content"}
        },
        {
            label: "deleted",
            before: snapshot({pageName: "Deleted Page"}),
            after: snapshot({exists: false, pageName: NON_EXISTENT_PAGE_NAME, content: ""}),
            expectedBefore: {pageName: "Deleted Page", content: "* Block content"},
            expectedAfter: {pageName: NON_EXISTENT_PAGE_NAME, content: ""}
        }
    ])("represents a $label page with an empty nonexistent side", (testCase) => {
        const [change] = LogseqPageDataPrinter.createChanges([testCase.before], [testCase.after]);

        expect(change.before).toEqual(testCase.expectedBefore);
        expect(change.after).toEqual(testCase.expectedAfter);
    });

    test("filters identities missing on both sides", () => {
        const missing = snapshot({
            resolvedPageUuid: null,
            exists: false,
            pageName: NON_EXISTENT_PAGE_NAME,
            content: ""
        });

        expect(LogseqPageDataPrinter.createChanges([missing], [missing])).toEqual([]);
    });

    test("pairs soft-deleted and active empty page snapshots by UUID", () => {
        const missing = snapshot({
            exists: false,
            pageName: NON_EXISTENT_PAGE_NAME,
            content: ""
        });
        const activeEmpty = snapshot({pageName: "Empty Page", content: ""});

        expect(LogseqPageDataPrinter.createChanges([missing], [activeEmpty])).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: NON_EXISTENT_PAGE_NAME, content: ""},
                after: {pageName: "Empty Page", content: ""}
            }
        ]);
        expect(LogseqPageDataPrinter.createChanges([activeEmpty], [missing])).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: "Empty Page", content: ""},
                after: {pageName: NON_EXISTENT_PAGE_NAME, content: ""}
            }
        ]);
    });

    test("rejects snapshots captured from different identity lists", () => {
        expect(() => LogseqPageDataPrinter.createChanges([snapshot()], [])).toThrow(
            "Cannot pair page snapshots with different lengths"
        );
    });
});
