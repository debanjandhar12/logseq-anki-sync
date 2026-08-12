import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {afterEach, describe, expect, test, vi} from "vitest";
import {LogseqEditor} from "../../../src/logseq/LogseqEditor";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("LogseqEditor", () => {
    test("resolves UUID tuple children recursively in page block trees", async () => {
        const nestedChild = createBlock("nested-child", []);
        const resolvedChild = createBlock("resolved-child", [["uuid", "nested-child"]]);
        const root = createBlock("root", [["uuid", "resolved-child"]]);
        const getBlock = vi.fn(async (uuid: string) => {
            if (uuid === "resolved-child") return resolvedChild;
            if (uuid === "nested-child") return nestedChild;
            return null;
        });
        vi.stubGlobal("logseq", {
            Editor: {
                getPageBlocksTree: vi.fn(async () => [root]),
                getBlock
            }
        });

        await expect(LogseqEditor.getPageBlocksTree("page-1")).resolves.toMatchObject([
            {
                uuid: "root",
                children: [
                    {
                        uuid: "resolved-child",
                        children: [{uuid: "nested-child", children: []}]
                    }
                ]
            }
        ]);
        expect(getBlock).toHaveBeenNthCalledWith(1, "resolved-child", {includeChildren: true});
        expect(getBlock).toHaveBeenNthCalledWith(2, "nested-child", {includeChildren: true});
    });

    test("rejects unresolved UUID tuple children", async () => {
        vi.stubGlobal("logseq", {
            Editor: {
                getPageBlocksTree: vi.fn(async () => [
                    createBlock("root", [["uuid", "missing-child"]])
                ]),
                getBlock: vi.fn(async () => null)
            }
        });

        await expect(LogseqEditor.getPageBlocksTree("page-1")).rejects.toThrow(
            "Unable to resolve block tree child: missing-child"
        );
    });
});

function createBlock(uuid: string, children: BlockEntity["children"]): BlockEntity {
    return {uuid, children} as BlockEntity;
}
