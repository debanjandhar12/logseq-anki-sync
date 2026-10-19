import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, describe, expect, test, vi} from "vitest";
import {isFlashcardBlock} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock";

function blockWith(content: unknown, tags: unknown[] = []): BlockEntity {
    return {content, format: "markdown", tags} as unknown as BlockEntity;
}

function cardTag(): PageEntity {
    return {id: 158, uuid: "card-tag-uuid"} as unknown as PageEntity;
}

afterEach(() => vi.unstubAllGlobals());

describe("isFlashcardBlock", () => {
    test("falls back to the Card class ident when the tag name is unavailable", async () => {
        const getTag = vi.fn(async (nameOrIdent: string) =>
            nameOrIdent === ":logseq.class/Card" ? cardTag() : null
        );
        vi.stubGlobal("logseq", {Editor: {getTag}});

        await expect(isFlashcardBlock(blockWith("No textual tag", [158]))).resolves.toBe(true);
        expect(getTag).toHaveBeenNthCalledWith(1, "card");
        expect(getTag).toHaveBeenNthCalledWith(2, ":logseq.class/Card");
    });

    test("recognizes a card tag from UUID entity references", async () => {
        vi.stubGlobal("logseq", {Editor: {getTag: vi.fn(async () => cardTag())}});

        await expect(
            isFlashcardBlock(blockWith("No textual tag", [{uuid: "card-tag-uuid"}]))
        ).resolves.toBe(true);
    });

    test("recognizes cloze macros without a tag", async () => {
        vi.stubGlobal("logseq", {Editor: {getTag: vi.fn(async () => null)}});

        await expect(isFlashcardBlock(blockWith("{{cloze answer text}}"))).resolves.toBe(true);
    });

    test("does not infer tags from block text", async () => {
        vi.stubGlobal("logseq", {Editor: {getTag: vi.fn(async () => cardTag())}});

        await expect(isFlashcardBlock(blockWith("#card"))).resolves.toBe(false);
    });
});
