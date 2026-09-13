import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, test} from "vitest";
import {isFlashcardBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock";

function blockWith(content: unknown, tags: unknown[] = []): BlockEntity {
    return {content, format: "markdown", tags} as unknown as BlockEntity;
}

const shouldRunTests =
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests)("isFlashcardBlock", () => {
    let cardTag: PageEntity | null;
    let createdCardTag = false;

    beforeAll(async () => {
        cardTag = await logseq.Editor.getTag("card");
        if (!cardTag) {
            cardTag = await logseq.Editor.createTag("card");
            createdCardTag = true;
        }
    });

    afterAll(async () => {
        if (createdCardTag && cardTag) await logseq.Editor.deletePage(cardTag.uuid);
    });

    test.each([
        "{{cloze answer text}}",
        "{{CLOZE answer text}}",
        "Before {{cloze answer text}} after"
    ])("recognizes cloze macro content: %s", async (content) => {
        await expect(isFlashcardBlock(blockWith(content))).resolves.toBe(true);
    });

    test("recognizes the card tag from Logseq entity references", async () => {
        expect(cardTag).not.toBeNull();

        await expect(isFlashcardBlock(blockWith("No textual tag", [cardTag!.id]))).resolves.toBe(
            true
        );
        await expect(
            isFlashcardBlock(blockWith("No textual tag", [{uuid: cardTag!.uuid}]))
        ).resolves.toBe(true);
    });

    test("does not infer tags from block text", async () => {
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
        await expect(isFlashcardBlock(blockWith(content))).resolves.toBe(false);
    });

    test("tolerates non-string content", async () => {
        await expect(isFlashcardBlock(blockWith(undefined))).resolves.toBe(false);
    });
});
