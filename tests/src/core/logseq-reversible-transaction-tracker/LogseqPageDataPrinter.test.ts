import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {
    LogseqPageDataPrinter,
    type LogseqPrintedPageSnapshot,
    NON_EXISTENT_PAGE_NAME
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {LogseqEditor} from "../../../../src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "../../../../src/logseq/LogseqPropertiesHelper";

vi.mock("../../../../src/logseq/LogseqPropertiesHelper", () => ({
    LogseqPropertiesHelper: {
        getPage: vi.fn(),
        getPageBlocksTree: vi.fn()
    }
}));
vi.mock("../../../../src/logseq/LogseqEditor", () => ({
    LogseqEditor: {
        isTagBlock: vi.fn(),
        isPropertyBlock: vi.fn()
    }
}));

const getPage = vi.mocked(LogseqPropertiesHelper.getPage);
const getPageBlocksTree = vi.mocked(LogseqPropertiesHelper.getPageBlocksTree);
const isTagBlock = vi.mocked(LogseqEditor.isTagBlock);
const isPropertyBlock = vi.mocked(LogseqEditor.isPropertyBlock);

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
        pageType: "logseq-page",
        ...overrides
    };
}

describe("LogseqPageDataPrinter", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        isTagBlock.mockResolvedValue(false);
        isPropertyBlock.mockResolvedValue(false);
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
                content: "* Parent Block",
                pageType: "logseq-page"
            },
            {
                identityKey: "page-uuid",
                resolvedPageUuid: "page-uuid",
                exists: true,
                pageName: "Hello World",
                content: "* Parent Block",
                pageType: "logseq-page"
            }
        ]);
        expect(getPage).toHaveBeenCalledTimes(2);
        expect(getPageBlocksTree).toHaveBeenCalledOnce();
        expect(isTagBlock).toHaveBeenCalledOnce();
        expect(isPropertyBlock).toHaveBeenCalledOnce();
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
                content: "",
                pageType: null
            },
            {
                identityKey: "deleted-uuid",
                resolvedPageUuid: "deleted-uuid",
                exists: false,
                pageName: NON_EXISTENT_PAGE_NAME,
                content: "",
                pageType: null
            }
        ]);
        expect(getPageBlocksTree).not.toHaveBeenCalled();
        expect(isTagBlock).not.toHaveBeenCalled();
        expect(isPropertyBlock).not.toHaveBeenCalled();
    });

    test("classifies tags before property pages", async () => {
        getPage.mockResolvedValue(page());
        getPageBlocksTree.mockResolvedValue([]);
        isTagBlock.mockResolvedValue(true);

        const [printedPage] = await LogseqPageDataPrinter.print(["page-uuid"]);

        expect(printedPage.pageType).toBe("logseq-tag-page");
        expect(isPropertyBlock).not.toHaveBeenCalled();
    });

    test("classifies property pages after ruling out tags", async () => {
        const propertyPage = page({uuid: "property-uuid"});
        getPage.mockResolvedValue(propertyPage);
        getPageBlocksTree.mockResolvedValue([]);
        isPropertyBlock.mockResolvedValue(true);

        const [printedPage] = await LogseqPageDataPrinter.print(["property-uuid"]);

        expect(printedPage.pageType).toBe("logseq-property-page");
        expect(isTagBlock).toHaveBeenCalledWith("property-uuid");
        expect(isPropertyBlock).toHaveBeenCalledWith("property-uuid");
    });

    test("classifies ordinary pages after ruling out tags and properties", async () => {
        getPage.mockResolvedValue(page());
        getPageBlocksTree.mockResolvedValue([]);

        const [printedPage] = await LogseqPageDataPrinter.print(["page-uuid"]);

        expect(printedPage.pageType).toBe("logseq-page");
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
                before: {pageName: "Test Page", content: "* Before", pageType: "logseq-page"},
                after: {pageName: "Test Page", content: "* After", pageType: "logseq-page"}
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
                before: {pageName: "Old Name", content: "* Block content", pageType: "logseq-page"},
                after: {pageName: "New Name", content: "* Block content", pageType: "logseq-page"}
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
                before: {
                    pageName: "First Before",
                    content: "* Block content",
                    pageType: "logseq-page"
                },
                after: {
                    pageName: "First After",
                    content: "* Block content",
                    pageType: "logseq-page"
                }
            },
            {
                key: "changed-page-1",
                before: {pageName: "Second", content: "* Old", pageType: "logseq-page"},
                after: {pageName: "Second", content: "* New", pageType: "logseq-page"}
            }
        ]);
    });

    test.each([
        {
            label: "created",
            before: snapshot({exists: false, pageName: NON_EXISTENT_PAGE_NAME, content: ""}),
            after: snapshot({pageName: "Created Page"}),
            expectedBefore: {pageName: NON_EXISTENT_PAGE_NAME, content: "", pageType: null},
            expectedAfter: {
                pageName: "Created Page",
                content: "* Block content",
                pageType: "logseq-page"
            }
        },
        {
            label: "deleted",
            before: snapshot({pageName: "Deleted Page"}),
            after: snapshot({exists: false, pageName: NON_EXISTENT_PAGE_NAME, content: ""}),
            expectedBefore: {
                pageName: "Deleted Page",
                content: "* Block content",
                pageType: "logseq-page"
            },
            expectedAfter: {pageName: NON_EXISTENT_PAGE_NAME, content: "", pageType: null}
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
                before: {pageName: NON_EXISTENT_PAGE_NAME, content: "", pageType: null},
                after: {pageName: "Empty Page", content: "", pageType: "logseq-page"}
            }
        ]);
        expect(LogseqPageDataPrinter.createChanges([activeEmpty], [missing])).toEqual([
            {
                key: "changed-page-0",
                before: {pageName: "Empty Page", content: "", pageType: "logseq-page"},
                after: {pageName: NON_EXISTENT_PAGE_NAME, content: "", pageType: null}
            }
        ]);
    });

    test("keeps changes that differ only by page type", () => {
        expect(
            LogseqPageDataPrinter.createChanges(
                [snapshot({pageType: "logseq-page"})],
                [snapshot({pageType: "logseq-tag-page"})]
            )
        ).toHaveLength(1);
    });

    test("rejects snapshots captured from different identity lists", () => {
        expect(() => LogseqPageDataPrinter.createChanges([snapshot()], [])).toThrow(
            "Cannot pair page snapshots with different lengths"
        );
    });
});
