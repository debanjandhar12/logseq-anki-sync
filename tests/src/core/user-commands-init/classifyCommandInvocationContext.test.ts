import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {isFlashcardBlock} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock";
import {isMathBlock} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isMathBlock";
import {
    classifyBlockCommandInvocationContext,
    classifyPageCommandInvocationContext
} from "../../../../src/core/user-commands-init/classifyCommandInvocationContext";
import {LogseqEditor} from "../../../../src/logseq/LogseqEditor";

vi.mock(
    "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock"
);
vi.mock("../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isMathBlock");

function blockWith(content: string): BlockEntity {
    return {
        id: 2,
        uuid: "block-uuid",
        content,
        format: "markdown",
        tags: []
    } as unknown as BlockEntity;
}

function pageWith(uuid: string): PageEntity {
    return {id: 1, uuid, name: "Page"} as PageEntity;
}

const PAGE_UUID = "00000000-0000-4000-8000-000000000001";

function stubBlock(block: BlockEntity) {
    vi.stubGlobal("logseq", {
        Editor: {
            getBlock: vi.fn(async () => block),
            getPage: vi.fn(async () => pageWith("page-uuid")),
            getTag: vi.fn(async () => null)
        }
    });
    vi.spyOn(LogseqEditor, "isPageBlock").mockResolvedValue(false);
    vi.spyOn(LogseqEditor, "isImageAssetBlock").mockReturnValue(false);
    vi.spyOn(LogseqEditor, "isPdfAssetBlock").mockReturnValue(false);
    vi.mocked(isFlashcardBlock).mockResolvedValue(false);
    vi.mocked(isMathBlock).mockResolvedValue(false);
}

beforeEach(() => {
    vi.mocked(isFlashcardBlock).mockReset();
    vi.mocked(isMathBlock).mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("classifyBlockCommandInvocationContext", () => {
    test("classifies a math block as Math", async () => {
        stubBlock(blockWith("$x^2$"));
        vi.mocked(isMathBlock).mockResolvedValue(true);

        await expect(classifyBlockCommandInvocationContext("block-uuid")).resolves.toMatchObject({
            location: "Block Context Menu/Math",
            uuid: "block-uuid"
        });
    });

    test("keeps flashcard precedence over math", async () => {
        stubBlock(blockWith("$x^2$"));
        vi.mocked(isFlashcardBlock).mockResolvedValue(true);
        vi.mocked(isMathBlock).mockResolvedValue(true);

        await expect(classifyBlockCommandInvocationContext("block-uuid")).resolves.toMatchObject({
            location: "Block Context Menu/Flashcard"
        });
        expect(isMathBlock).not.toHaveBeenCalled();
    });

    test("keeps video precedence over math", async () => {
        stubBlock(blockWith("{{video https://example.com/video}}"));
        vi.mocked(isMathBlock).mockResolvedValue(true);

        await expect(classifyBlockCommandInvocationContext("block-uuid")).resolves.toMatchObject({
            location: "Block Context Menu/Video"
        });
        expect(isMathBlock).not.toHaveBeenCalled();
    });

    test.each([
        ["Image", "isImageAssetBlock", "Block Context Menu/Image"],
        ["Pdf", "isPdfAssetBlock", "Block Context Menu/Pdf"]
    ] as const)("keeps %s precedence over math", async (_name, method, location) => {
        stubBlock(blockWith("$x^2$"));
        vi.spyOn(LogseqEditor, method).mockReturnValue(true);
        vi.mocked(isMathBlock).mockResolvedValue(true);

        await expect(classifyBlockCommandInvocationContext("block-uuid")).resolves.toMatchObject({
            location
        });
        expect(isMathBlock).not.toHaveBeenCalled();
    });

    test("leaves ordinary blocks in Other Blocks", async () => {
        stubBlock(blockWith("plain text"));

        await expect(classifyBlockCommandInvocationContext("block-uuid")).resolves.toMatchObject({
            location: "Block Context Menu/Other Blocks"
        });
    });

    test("rejects page entities", async () => {
        stubBlock(blockWith("plain text"));
        vi.spyOn(LogseqEditor, "isPageBlock").mockResolvedValue(true);

        await expect(classifyBlockCommandInvocationContext("block-uuid")).rejects.toThrow(
            "Page entities are excluded"
        );
    });
});

describe("classifyPageCommandInvocationContext", () => {
    test("does not classify pages as Math", async () => {
        vi.stubGlobal("logseq", {
            Editor: {
                getPage: vi.fn(async () => pageWith(PAGE_UUID)),
                getTag: vi.fn(async () => null)
            },
            DB: {datascriptQuery: vi.fn(async () => [])}
        });
        vi.spyOn(LogseqEditor, "isTagBlock").mockResolvedValue(false);
        vi.spyOn(LogseqEditor, "isPropertyBlock").mockResolvedValue(false);

        await expect(classifyPageCommandInvocationContext("Page")).resolves.toMatchObject({
            location: "Page Context Menu/Other Pages",
            uuid: PAGE_UUID
        });
        expect(isMathBlock).not.toHaveBeenCalled();
    });
});
