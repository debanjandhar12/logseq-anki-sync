import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, describe, expect, test, vi} from "vitest";
import {isMathBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isMathBlock";

function blockWith(content: unknown, tags: unknown[] = []): BlockEntity {
    return {content, format: "markdown", tags} as unknown as BlockEntity;
}

function mathTag(): PageEntity {
    return {id: 42, uuid: "math-tag-uuid"} as unknown as PageEntity;
}

function stubTags(...tags: Array<PageEntity | null>): ReturnType<typeof vi.fn> {
    const getTag = vi.fn(async () => tags.shift() ?? null);
    vi.stubGlobal("logseq", {Editor: {getTag}});
    return getTag;
}

afterEach(() => vi.unstubAllGlobals());

describe("isMathBlock", () => {
    test("recognizes a math tag from numeric entity references", async () => {
        stubTags(mathTag());

        await expect(isMathBlock(blockWith("No textual tag", [42]))).resolves.toBe(true);
    });

    test("recognizes a math tag from UUID entity references", async () => {
        stubTags(mathTag());

        await expect(
            isMathBlock(blockWith("No textual tag", [{uuid: "math-tag-uuid"}]))
        ).resolves.toBe(true);
    });

    test("falls back to the Math-block class ident when the tag name is unavailable", async () => {
        const getTag = stubTags(null, mathTag());

        await expect(isMathBlock(blockWith("No textual tag", [42]))).resolves.toBe(true);
        expect(getTag).toHaveBeenNthCalledWith(1, "Math");
        expect(getTag).toHaveBeenNthCalledWith(2, ":logseq.class/Math-block");
    });

    test("recognizes LaTeX content without the tag", async () => {
        stubTags(null, null);

        await expect(isMathBlock(blockWith("$x^2$"))).resolves.toBe(true);
        await expect(isMathBlock(blockWith("$$\nx^2\n$$"))).resolves.toBe(true);
    });

    test("does not infer the tag from block text", async () => {
        stubTags(mathTag());

        await expect(isMathBlock(blockWith("#Math x^2"))).resolves.toBe(false);
    });

    test.each([
        "",
        "plain text",
        "`$x$`",
        "$5 and $10"
    ])("rejects non-math content: %s", async (content) => {
        stubTags(null, null);
        await expect(isMathBlock(blockWith(content))).resolves.toBe(false);
    });

    test("tolerates non-string content", async () => {
        stubTags(null, null);
        await expect(isMathBlock(blockWith(undefined))).resolves.toBe(false);
    });
});
