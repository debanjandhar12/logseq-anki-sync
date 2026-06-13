import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {
    type InMemoryBlockEntity,
    type InMemoryPageLoader,
    LogseqInMemoryDataPrinter
} from "../../../../src/core/logseq-fakeable-transaction-tracker";
import {createInMemoryExecutor, generateIdentities} from "./helpers/createInMemoryExecutor";

describe("InMemoryExecutor", () => {
    describe("transaction scenarios", () => {
        test("creates, edits, moves, renames, and deletes a multi-page block tree", async () => {
            const identities = generateIdentities(6);
            const [pageAUuid, rootUuid, childUuid, grandchildUuid, pageBUuid, destinationUuid] =
                identities;
            const executor = createInMemoryExecutor();

            await executor.createPage("Page A", {category: "source"});
            await executor.insertBlock(pageAUuid, "Root");
            await executor.insertBlock(rootUuid, "Child");
            await executor.insertBlock(childUuid, "Grandchild");
            await executor.createPage("Page B");
            await executor.insertBlock(pageBUuid, "Destination");
            await executor.moveBlock(rootUuid, destinationUuid);
            await executor.updateBlock(grandchildUuid, "Updated grandchild");
            await executor.renamePage(pageBUuid, "Renamed Page B");

            const pageA = executor.getInMemoryPageDataDb().get(pageAUuid);
            const pageB = executor.getInMemoryPageDataDb().get(pageBUuid);
            const destination = pageB?.children?.[0] as InMemoryBlockEntity;
            const movedRoot = destination.children?.[0] as InMemoryBlockEntity;
            const movedChild = movedRoot.children?.[0] as InMemoryBlockEntity;
            const movedGrandchild = movedChild.children?.[0] as InMemoryBlockEntity;

            expect(pageA?.children).toEqual([]);
            expect(pageB?.name).toBe("Renamed Page B");
            expect(movedRoot.parent).toEqual({uuid: destinationUuid});
            expect(movedRoot.page).toEqual({uuid: pageBUuid});
            expect(movedChild.page).toEqual({uuid: pageBUuid});
            expect(movedGrandchild.page).toEqual({uuid: pageBUuid});
            expect(movedGrandchild.content).toBe("Updated grandchild");
            expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toContain(
                [
                    "* Destination",
                    "    * Root",
                    "        * Child",
                    "            * Updated grandchild"
                ].join("\n")
            );

            await executor.deletePage(pageAUuid);
            await executor.deletePage(pageBUuid);
            expect(executor.getInMemoryPageDataDb()).toEqual(new Map());
            expect(LogseqInMemoryDataPrinter.print(executor.getInMemoryPageDataDb())).toBe("");
        });
    });

    describe("createPage", () => {
        test("rejects duplicate page names", async () => {
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");

            await expect(executor.createPage("Page")).rejects.toThrow("Page already exists: Page");
        });
    });

    describe("moveBlock", () => {
        test("restores the source subtree when the destination does not exist", async () => {
            const [pageUuid, rootUuid, childUuid] = generateIdentities(3);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Root");
            await executor.insertBlock(rootUuid, "Child");

            await expect(executor.moveBlock(rootUuid, "missing-destination")).rejects.toThrow(
                "Failed to find destination block during moveBlock"
            );

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            const root = page?.children?.[0] as InMemoryBlockEntity;
            expect(root.uuid).toBe(rootUuid);
            expect(root.children?.[0]?.uuid).toBe(childUuid);
            expect(root.parent).toEqual({uuid: pageUuid});
        });
    });

    describe("readBlockOrPage", () => {
        test("returns a clone and omits children when requested", async () => {
            const [pageUuid, blockUuid] = generateIdentities(2);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Block");

            const result = await executor.readBlockOrPage(blockUuid, false);
            expect(result).not.toHaveProperty("children");

            if (result) result.content = "Mutated clone";
            const storedBlock = executor.getInMemoryPageDataDb().get(pageUuid)
                ?.children?.[0] as InMemoryBlockEntity;
            expect(storedBlock.content).toBe("Block");
        });

        test("imports a page by name", async () => {
            const loader = new StubPageLoader();
            const executor = createInMemoryExecutor(loader);

            const result = await executor.readBlockOrPage("Imported Page", false);

            expect(loader.loadedIdentities).toEqual(["Imported Page"]);
            expect(result).toMatchObject({uuid: "imported-page", name: "Imported Page"});
            expect(result).not.toHaveProperty("children");
        });
    });

    describe("renamePage", () => {
        test("rejects duplicate page names", async () => {
            const [pageAUuid, pageBUuid] = generateIdentities(2);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page A");
            await executor.createPage("Page B");

            await expect(executor.renamePage(pageBUuid, "Page A")).rejects.toThrow(
                "Page already exists: Page A"
            );
            expect(executor.getInMemoryPageDataDb().get(pageAUuid)?.name).toBe("Page A");
            expect(executor.getInMemoryPageDataDb().get(pageBUuid)?.name).toBe("Page B");
        });

        test("allows renaming a page to its current name", async () => {
            const [pageUuid] = generateIdentities(1);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.renamePage(pageUuid, "Page");

            expect(executor.getInMemoryPageDataDb().get(pageUuid)?.name).toBe("Page");
        });
    });

    describe("imported pages", () => {
        test("keeps the original snapshot unchanged while mutating the working copy", async () => {
            const loader = new StubPageLoader();
            const executor = createInMemoryExecutor(loader);

            await executor.updateBlock("imported-block", "Updated");

            const originalPage = executor.getOriginalInMemoryPageDataDb().get("imported-page");
            const currentPage = executor.getInMemoryPageDataDb().get("imported-page");
            const originalBlock = originalPage?.children?.[0] as InMemoryBlockEntity;
            const currentBlock = currentPage?.children?.[0] as InMemoryBlockEntity;

            expect(loader.loadedIdentities).toEqual(["imported-block"]);
            expect(originalBlock.content).toBe("Original");
            expect(currentBlock.content).toBe("Updated");
            expect(originalBlock).not.toBe(currentBlock);
        });
    });
});

class StubPageLoader implements InMemoryPageLoader {
    public readonly loadedIdentities: unknown[] = [];

    public async loadPageForIdentity(identity: unknown) {
        this.loadedIdentities.push(identity);
        if (identity !== "Imported Page" && identity !== "imported-block") return null;

        return {
            page: {
                uuid: "imported-page",
                name: "Imported Page",
                title: "Imported Page",
                fullTitle: "Imported Page",
                content: "Imported Page",
                properties: {uuid: "imported-page"},
                "journal?": false
            } as unknown as PageEntity,
            blocks: [
                {
                    uuid: "imported-block",
                    content: "Original",
                    title: "Original",
                    fullTitle: "Original",
                    properties: {uuid: "imported-block"},
                    parent: {uuid: "imported-page"},
                    page: {uuid: "imported-page"},
                    children: []
                } as unknown as BlockEntity
            ]
        };
    }
}
