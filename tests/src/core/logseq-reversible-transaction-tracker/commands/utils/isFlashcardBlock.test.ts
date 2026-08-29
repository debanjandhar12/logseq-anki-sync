import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, describe, expect, test, vi} from "vitest";
import {isFlashcardBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock";

function blockWith(content: unknown, tags: unknown[] = []): BlockEntity {
    return {content, format: "markdown", tags} as unknown as BlockEntity;
}

describe("isFlashcardBlock", () => {
    afterEach(() => vi.unstubAllGlobals());

    function mockCardTag(cardTag: object | null = {id: 42, uuid: "card-tag"}): void {
        vi.stubGlobal("logseq", {
            Editor: {getTag: vi.fn(async () => cardTag)}
        });
    }

    test.each([
        "{{cloze answer text}}",
        "{{CLOZE answer text}}",
        "Before {{cloze answer text}} after"
    ])("recognizes cloze macro content: %s", async (content) => {
        mockCardTag(null);
        await expect(isFlashcardBlock(blockWith(content))).resolves.toBe(true);
    });

    test("recognizes the card tag from Logseq entity references", async () => {
        mockCardTag();

        await expect(isFlashcardBlock(blockWith("No textual tag", [42]))).resolves.toBe(true);
        await expect(
            isFlashcardBlock(blockWith("No textual tag", [{uuid: "card-tag"}]))
        ).resolves.toBe(true);
    });

    test("does not infer tags from block text", async () => {
        mockCardTag();
        await expect(isFlashcardBlock(blockWith("#card"))).resolves.toBe(false);
    });

    test.each([
        "",
        "{{cloze}}",
        "{{clozed answer text}}",
        "{{cloze answer text",
        "{{cloze multiline\nanswer}}",
        "`{{cloze answer text}}`",
        "```\n{{cloze answer text}}\n```",
        "$$ {{cloze answer text}} $$",
        "plain text"
    ])("rejects non-cloze or literal content: %s", async (content) => {
        mockCardTag(null);
        await expect(isFlashcardBlock(blockWith(content))).resolves.toBe(false);
    });

    test("tolerates non-string content", async () => {
        mockCardTag(null);
        await expect(isFlashcardBlock(blockWith(undefined))).resolves.toBe(false);
    });
});
