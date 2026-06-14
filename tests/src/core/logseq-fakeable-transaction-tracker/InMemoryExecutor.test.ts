import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {
    type InMemoryBlockEntity,
    type InMemoryPageLoader,
    InsertBlockCommand,
    LogseqFakeableTransactionTracker,
    LogseqFakeableTransactionTrackerSerializer,
    LogseqInMemoryDataPrinter
} from "../../../../src/core/logseq-fakeable-transaction-tracker";
import {MoveBlockCommand} from "../../../../src/core/logseq-fakeable-transaction-tracker/commands";
import {createInMemoryExecutor, generateIdentities} from "./helpers/createInMemoryExecutor";

describe("InMemoryExecutor", () => {
    describe("transaction scenarios", () => {
        test("creates, edits, moves, renames, and deletes a multi-page block tree", async () => {
            const identities = generateIdentities(6);
            const [pageAUuid, rootUuid, childUuid, grandchildUuid, pageBUuid, destinationUuid] =
                identities;
            const executor = createInMemoryExecutor();

            await executor.createPage("Page A");
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

        test("rejects moving a block into its own subtree without changing the tree", async () => {
            const [pageUuid, rootUuid, childUuid, grandchildUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Root");
            await executor.insertBlock(rootUuid, "Child");
            await executor.insertBlock(childUuid, "Grandchild");

            await expect(executor.moveBlock(rootUuid, grandchildUuid)).rejects.toThrow(
                "Cannot move a block inside its own subtree"
            );

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            const root = page?.children?.[0] as InMemoryBlockEntity;
            const child = root.children?.[0] as InMemoryBlockEntity;
            const grandchild = child.children?.[0] as InMemoryBlockEntity;
            expect(root.uuid).toBe(rootUuid);
            expect(root.parent).toEqual({uuid: pageUuid});
            expect(child.uuid).toBe(childUuid);
            expect(child.parent).toEqual({uuid: rootUuid});
            expect(grandchild.uuid).toBe(grandchildUuid);
            expect(grandchild.parent).toEqual({uuid: childUuid});
        });

        test("moves a block across pages and updates subtree page references", async () => {
            const [pageAUuid, rootUuid, childUuid, pageBUuid, destinationUuid] =
                generateIdentities(5);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page A");
            await executor.insertBlock(pageAUuid, "Root");
            await executor.insertBlock(rootUuid, "Child");
            await executor.createPage("Page B");
            await executor.insertBlock(pageBUuid, "Destination");

            await executor.moveBlock(rootUuid, destinationUuid);

            const pageA = executor.getInMemoryPageDataDb().get(pageAUuid);
            const pageB = executor.getInMemoryPageDataDb().get(pageBUuid);
            const destination = pageB?.children?.[0] as InMemoryBlockEntity;
            const movedRoot = destination.children?.[0] as InMemoryBlockEntity;
            const movedChild = movedRoot.children?.[0] as InMemoryBlockEntity;
            expect(pageA?.children).toEqual([]);
            expect(movedRoot.uuid).toBe(rootUuid);
            expect(movedRoot.parent).toEqual({uuid: destinationUuid});
            expect(movedRoot.page).toEqual({uuid: pageBUuid});
            expect(movedChild.uuid).toBe(childUuid);
            expect(movedChild.page).toEqual({uuid: pageBUuid});
        });

        test("moves under destination by default and with children true", async () => {
            const [pageUuid, sourceUuid, destinationUuid, secondSourceUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Source");
            await executor.insertBlock(pageUuid, "Destination");
            await executor.insertBlock(pageUuid, "Second source");

            await executor.moveBlock(sourceUuid, destinationUuid);
            await executor.moveBlock(secondSourceUuid, destinationUuid, {children: true});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            const destination = page?.children?.[0] as InMemoryBlockEntity;
            expect(destination.uuid).toBe(destinationUuid);
            expect(destination.children?.map((child) => child.uuid)).toEqual([
                sourceUuid,
                secondSourceUuid
            ]);
        });

        test("rejects children false", async () => {
            const [pageUuid, sourceUuid, destinationUuid] = generateIdentities(3);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Source");
            await executor.insertBlock(pageUuid, "Destination");

            await expect(
                executor.moveBlock(sourceUuid, destinationUuid, {children: false})
            ).rejects.toThrow("moveBlock with children: false is not supported");
        });

        test("moves a block before another block", async () => {
            const [pageUuid, firstUuid, secondUuid, thirdUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "First");
            await executor.insertBlock(pageUuid, "Second");
            await executor.insertBlock(pageUuid, "Third");

            await executor.moveBlock(thirdUuid, secondUuid, {before: true});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            expect(page?.children?.map((child) => child.uuid)).toEqual([
                firstUuid,
                thirdUuid,
                secondUuid
            ]);
            const movedBlock = page?.children?.[1] as InMemoryBlockEntity;
            expect(movedBlock.parent).toEqual({uuid: pageUuid});
        });
    });

    describe("insertBlock", () => {
        test("inserts as first and last child", async () => {
            const [pageUuid, parentUuid, lastUuid, firstUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Parent");
            await executor.insertBlock(parentUuid, "Last", {end: true});
            await executor.insertBlock(parentUuid, "First", {start: true});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            const parent = page?.children?.[0] as InMemoryBlockEntity;
            expect(parent.children?.map((child) => child.uuid)).toEqual([firstUuid, lastUuid]);
        });

        test("inserts sibling before and after", async () => {
            const [pageUuid, targetUuid, beforeUuid, afterUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Target");
            await executor.insertBlock(targetUuid, "Before", {sibling: true, before: true});
            await executor.insertBlock(targetUuid, "After", {sibling: true, before: false});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            expect(page?.children?.map((child) => child.uuid)).toEqual([
                beforeUuid,
                targetUuid,
                afterUuid
            ]);
        });

        test("inserts first child with before true when source has children", async () => {
            const [pageUuid, parentUuid, existingChildUuid, firstChildUuid] = generateIdentities(4);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Parent");
            await executor.insertBlock(parentUuid, "Existing child");
            await executor.insertBlock(parentUuid, "First child", {before: true});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            const parent = page?.children?.[0] as InMemoryBlockEntity;
            expect(parent.children?.map((child) => child.uuid)).toEqual([
                firstChildUuid,
                existingChildUuid
            ]);
        });

        test("inserts sibling before with before true when source has no children", async () => {
            const [pageUuid, targetUuid, beforeUuid] = generateIdentities(3);
            const executor = createInMemoryExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Target");
            await executor.insertBlock(targetUuid, "Before", {before: true});

            const page = executor.getInMemoryPageDataDb().get(pageUuid);
            expect(page?.children?.map((child) => child.uuid)).toEqual([beforeUuid, targetUuid]);
        });
    });

    describe("serialization", () => {
        test("round-trips insert and move command options", () => {
            const tracker = new LogseqFakeableTransactionTracker();

            tracker.addCommand(new InsertBlockCommand("parent", "content", {start: true}));
            tracker.addCommand(new MoveBlockCommand("source", "destination", {before: true}));

            const serialized = LogseqFakeableTransactionTrackerSerializer.serialize(tracker);
            const deserialized = LogseqFakeableTransactionTrackerSerializer.deserialize(serialized);

            expect(
                LogseqFakeableTransactionTrackerSerializer.serialize(deserialized).commands
            ).toEqual([
                {
                    type: "InsertBlock",
                    parentUuid: "parent",
                    content: "content",
                    options: {start: true}
                },
                {
                    type: "MoveBlock",
                    srcBlockUuid: "source",
                    destBlockUuid: "destination",
                    options: {before: true}
                }
            ]);
        });

        test("deserializes old commands without options", () => {
            const tracker = LogseqFakeableTransactionTrackerSerializer.deserialize({
                uuidGenerationSeed: "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d",
                commands: [
                    {type: "InsertBlock", parentUuid: "parent", content: "content"},
                    {type: "MoveBlock", srcBlockUuid: "source", destBlockUuid: "destination"}
                ]
            });

            expect(LogseqFakeableTransactionTrackerSerializer.serialize(tracker).commands).toEqual([
                {
                    type: "InsertBlock",
                    parentUuid: "parent",
                    content: "content",
                    options: undefined
                },
                {
                    type: "MoveBlock",
                    srcBlockUuid: "source",
                    destBlockUuid: "destination",
                    options: undefined
                }
            ]);
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
