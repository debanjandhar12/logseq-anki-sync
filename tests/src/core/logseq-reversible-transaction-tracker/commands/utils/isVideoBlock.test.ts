import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {isVideoBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isVideoBlock";

function blockWithContent(content: unknown): Pick<BlockEntity, "content" | "format"> {
    return {content, format: "markdown"} as Pick<BlockEntity, "content" | "format">;
}

describe("isVideoBlock", () => {
    test.each([
        "{{video https://example.com/video}}",
        "Before {{VIDEO https://example.com/video}} after"
    ])("recognizes video macro content: %s", (content) => {
        expect(isVideoBlock(blockWithContent(content))).toBe(true);
    });

    test.each([
        "",
        "video https://example.com/video",
        "{{video}}",
        "{{videography https://example.com/video}}",
        "{{video https://example.com/video",
        "{{video multiline\nargument}}",
        "`{{video https://example.com/video}}`",
        "```\n{{video https://example.com/video}}\n```",
        "$$ {{video https://example.com/video}} $$",
        "plain text"
    ])("rejects non-video content: %s", (content) => {
        expect(isVideoBlock(blockWithContent(content))).toBe(false);
    });

    test("tolerates non-string content", () => {
        expect(isVideoBlock(blockWithContent(null))).toBe(false);
    });
});
