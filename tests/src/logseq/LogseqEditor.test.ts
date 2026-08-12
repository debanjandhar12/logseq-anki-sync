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

    test("forwards block icon and collapsed presentation operations", async () => {
        const setBlockIcon = vi.fn(async () => undefined);
        const removeBlockIcon = vi.fn(async () => undefined);
        const setBlockCollapsed = vi.fn(async () => undefined);
        vi.stubGlobal("logseq", {
            Editor: {setBlockIcon, removeBlockIcon, setBlockCollapsed}
        });

        await LogseqEditor.setBlockIcon("block-1", "message-user");
        await LogseqEditor.setBlockIcon("block-2", "message-chatbot");
        await LogseqEditor.removeBlockIcon("block-3");
        await LogseqEditor.setBlockCollapsed("block-4", true);

        expect(setBlockIcon).toHaveBeenNthCalledWith(1, "block-1", "tabler-icon", "message-user");
        expect(setBlockIcon).toHaveBeenNthCalledWith(
            2,
            "block-2",
            "tabler-icon",
            "message-chatbot"
        );
        expect(removeBlockIcon).toHaveBeenCalledWith("block-3");
        expect(setBlockCollapsed).toHaveBeenCalledWith("block-4", true);
    });

    test("propagates block presentation failures", async () => {
        const failure = new Error("icon failed");
        vi.stubGlobal("logseq", {
            Editor: {
                setBlockIcon: vi.fn(async () => {
                    throw failure;
                })
            }
        });

        await expect(LogseqEditor.setBlockIcon("block-1", "message-user")).rejects.toBe(failure);
    });
});

function createBlock(uuid: string, children: BlockEntity["children"]): BlockEntity {
    return {uuid, children} as BlockEntity;
}
