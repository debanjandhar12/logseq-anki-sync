import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {blockHasLatex} from "../../../../src/core/logseq-md-parser";

function blockWithContent(
    content: unknown,
    format: BlockEntity["format"] = "markdown"
): Pick<BlockEntity, "content" | "format"> {
    return {content, format} as Pick<BlockEntity, "content" | "format">;
}

describe("blockHasLatex", () => {
    test.each([
        "$x^2$",
        "before $$x$$ after",
        "$$\nx^2\n$$",
        "# $x$",
        "> $x$",
        "| $x$ | y |\n|---|---|\n| 1 | 2 |",
        "\\(x\\)",
        "\\[x\\]"
    ])("recognizes LaTeX math content: %s", (content) => {
        expect(blockHasLatex(blockWithContent(content))).toBe(true);
    });

    test.each([
        "",
        "plain text",
        "`$x$`",
        "```\n$x$\n```",
        "<code>$x$</code>",
        "$5 and $10",
        "cost $5, $10, and $20",
        "Cost $5",
        "$ x $",
        "$$$$",
        "$$ $$",
        "\\$x\\$",
        "**$x$**",
        "#Math x^2"
    ])("rejects non-math or literal content: %s", (content) => {
        expect(blockHasLatex(blockWithContent(content))).toBe(false);
    });

    test("tolerates non-string content", () => {
        expect(blockHasLatex(blockWithContent(undefined))).toBe(false);
        expect(blockHasLatex(blockWithContent(null))).toBe(false);
    });

    test("uses the block format when parsing", () => {
        expect(blockHasLatex(blockWithContent("$x$", "org"))).toBe(true);
    });
});
