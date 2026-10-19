import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {isMathBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isMathBlock";

function blockWith(content: unknown, tags: unknown[] = []): BlockEntity {
    return {content, format: "markdown", tags} as unknown as BlockEntity;
}

const shouldRunTests =
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests)("isMathBlock", () => {
    test("recognizes the built-in Math tag from entity references", async () => {
        const mathTag = await logseq.Editor.getTag(":logseq.class/Math-block");
        expect(mathTag).not.toBeNull();

        await expect(isMathBlock(blockWith("x^2", [mathTag!.id]))).resolves.toBe(true);
        await expect(isMathBlock(blockWith("x^2", [{uuid: mathTag!.uuid}]))).resolves.toBe(true);
    });

    test.each([
        "$x^2$",
        "before $$x$$ after",
        "$$\nx^2\n$$",
        "\\(x\\)",
        "\\[x\\]"
    ])("recognizes LaTeX content without the tag: %s", async (content) => {
        await expect(isMathBlock(blockWith(content))).resolves.toBe(true);
    });

    test("does not infer tags from block text", async () => {
        await expect(isMathBlock(blockWith("#Math x^2"))).resolves.toBe(false);
    });

    test.each([
        "",
        "plain text",
        "`$x$`",
        "$5 and $10",
        "**$x$**"
    ])("rejects non-math or literal content: %s", async (content) => {
        await expect(isMathBlock(blockWith(content))).resolves.toBe(false);
    });

    test("tolerates non-string content", async () => {
        await expect(isMathBlock(blockWith(undefined))).resolves.toBe(false);
    });
});
