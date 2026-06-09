import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, test} from "vitest";
import {
    CreatePageCommand,
    DeletePageCommand,
    DeterminesticUUIDGenerator,
    type InMemoryBlockEntity,
    InMemoryExecutor,
    type InMemoryPageLoader,
    InsertBlockCommand,
    LogseqFakeableTransactionTracker,
    LogseqInMemoryDataPrinter,
    MoveBlockCommand,
    RenamePageCommand,
    UpdateBlockCommand
} from "../../../../src/core/logseq-fakeable-transaction-tracker";

const UUID_SEED = "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d";

describe("InMemoryExecutor", () => {
    describe("transaction scenarios", () => {
        test("creates, edits, moves, renames, and deletes a multi-page block tree", async () => {
            const identities = generateIdentities(6);
            const [pageAUuid, rootUuid, childUuid, grandchildUuid, pageBUuid, destinationUuid] =
                identities;
            const tracker = new LogseqFakeableTransactionTracker();
            tracker.setUuidGenerationSeed(UUID_SEED);

            tracker.addCommand(new CreatePageCommand("Page A", {category: "source"}));
            tracker.addCommand(new InsertBlockCommand(pageAUuid, "Root"));
            tracker.addCommand(new InsertBlockCommand(rootUuid, "Child"));
            tracker.addCommand(new InsertBlockCommand(childUuid, "Grandchild"));
            tracker.addCommand(new CreatePageCommand("Page B"));
            tracker.addCommand(new InsertBlockCommand(pageBUuid, "Destination"));
            tracker.addCommand(new MoveBlockCommand(rootUuid, destinationUuid));
            tracker.addCommand(new UpdateBlockCommand(grandchildUuid, "Updated grandchild"));
            tracker.addCommand(new RenamePageCommand(pageBUuid, "Renamed Page B"));

            const movedExecutor = await tracker.executeInTheInMemoryDB();
            const pageA = movedExecutor.getInMemoryPageDataDb().get(pageAUuid);
            const pageB = movedExecutor.getInMemoryPageDataDb().get(pageBUuid);
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
            expect(
                LogseqInMemoryDataPrinter.print(movedExecutor.getInMemoryPageDataDb())
            ).toContain(
                [
                    "* Destination",
                    "    * Root",
                    "        * Child",
                    "            * Updated grandchild"
                ].join("\n")
            );

            tracker.addCommand(new DeletePageCommand(pageAUuid));
            tracker.addCommand(new DeletePageCommand(pageBUuid));

            const deletedExecutor = await tracker.executeInTheInMemoryDB();
            expect(deletedExecutor.getInMemoryPageDataDb()).toEqual(new Map());
            expect(LogseqInMemoryDataPrinter.print(deletedExecutor.getInMemoryPageDataDb())).toBe(
                ""
            );
        });
    });

    describe("moveBlock", () => {
        test("restores the source subtree when the destination does not exist", async () => {
            const [pageUuid, rootUuid, childUuid] = generateIdentities(3);
            const executor = createExecutor();

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
            const executor = createExecutor();

            await executor.createPage("Page");
            await executor.insertBlock(pageUuid, "Block");

            const result = await executor.readBlockOrPage(blockUuid, false);
            expect(result).not.toHaveProperty("children");

            if (result) result.content = "Mutated clone";
            const storedBlock = executor.getInMemoryPageDataDb().get(pageUuid)
                ?.children?.[0] as InMemoryBlockEntity;
            expect(storedBlock.content).toBe("Block");
        });
    });

    describe("imported pages", () => {
        test("keeps the original snapshot unchanged while mutating the working copy", async () => {
            const loader = new StubPageLoader();
            const executor = createExecutor(loader);

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

function createExecutor(pageLoader?: InMemoryPageLoader): InMemoryExecutor {
    return new InMemoryExecutor(
        new DeterminesticUUIDGenerator(UUID_SEED),
        pageLoader ?? new NullPageLoader()
    );
}

function generateIdentities(count: number): string[] {
    const generator = new DeterminesticUUIDGenerator(UUID_SEED);
    return Array.from({length: count}, () => generator.getUUID());
}

class StubPageLoader implements InMemoryPageLoader {
    public readonly loadedIdentities: unknown[] = [];

    public async loadPageForIdentity(identity: unknown) {
        this.loadedIdentities.push(identity);
        return {
            page: {
                uuid: "imported-page",
                name: "Imported Page",
                title: "Imported Page",
                fullTitle: "Imported Page",
                content: "Imported Page",
                properties: {uuid: "imported-page"},
                "journal?": false
            } as PageEntity,
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
                } as BlockEntity
            ]
        };
    }
}

class NullPageLoader implements InMemoryPageLoader {
    public async loadPageForIdentity() {
        return null;
    }
}
