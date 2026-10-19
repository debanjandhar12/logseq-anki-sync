import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, describe, expect, test, vi} from "vitest";
import {getTagByNameOrIdent} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/getTagByNameOrIdent";

function tag(): PageEntity {
    return {id: 1, uuid: "tag-uuid"} as unknown as PageEntity;
}

afterEach(() => vi.unstubAllGlobals());

describe("getTagByNameOrIdent", () => {
    test("prefers the tag name and skips the ident lookup", async () => {
        const getTag = vi.fn(async () => tag());
        vi.stubGlobal("logseq", {Editor: {getTag}});

        await expect(getTagByNameOrIdent("Math", ":logseq.class/Math-block")).resolves.toEqual(
            tag()
        );
        expect(getTag).toHaveBeenCalledOnce();
        expect(getTag).toHaveBeenCalledWith("Math");
    });

    test("falls back to the class ident when the name is unavailable", async () => {
        const getTag = vi.fn(async (nameOrIdent: string) =>
            nameOrIdent === ":logseq.class/Math-block" ? tag() : null
        );
        vi.stubGlobal("logseq", {Editor: {getTag}});

        await expect(getTagByNameOrIdent("Math", ":logseq.class/Math-block")).resolves.toEqual(
            tag()
        );
        expect(getTag).toHaveBeenNthCalledWith(1, "Math");
        expect(getTag).toHaveBeenNthCalledWith(2, ":logseq.class/Math-block");
    });

    test("returns null when neither lookup finds a tag", async () => {
        vi.stubGlobal("logseq", {Editor: {getTag: vi.fn(async () => null)}});

        await expect(getTagByNameOrIdent("Math", ":logseq.class/Math-block")).resolves.toBeNull();
    });

    test("propagates lookup failures", async () => {
        vi.stubGlobal("logseq", {
            Editor: {
                getTag: vi.fn(async () => {
                    throw new Error("API unavailable");
                })
            }
        });

        await expect(getTagByNameOrIdent("Math", ":logseq.class/Math-block")).rejects.toThrow(
            "API unavailable"
        );
    });
});
