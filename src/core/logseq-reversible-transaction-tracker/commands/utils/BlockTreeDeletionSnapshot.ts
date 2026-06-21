import type {BlockEntity, BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {normalizeBlock} from "./normalizeBlock";

export type DeletedBlockTreeSnapshot = {
    uuid: string;
    block: BlockEntity;
    previousSiblingUuid?: string;
    nextSiblingUuid?: string;
    children: DeletedBlockTreeSnapshot[];
};

export type RestoreBlockTreeDestination = {
    parentUuid: string;
    previousSiblingUuid?: string;
    nextSiblingUuid?: string;
};

const nonRestorablePropertyKeys = new Set(["id", "uuid"]);

export class BlockTreeDeletionSnapshot {
    public static async capture(blockUUID: BlockIdentity): Promise<DeletedBlockTreeSnapshot> {
        const rawBlock = await LogseqPropertiesHelper.getBlock(blockUUID, {includeChildren: true});
        if (!rawBlock) throw new Error(`Block not found: ${JSON.stringify(blockUUID)}`);

        return await BlockTreeDeletionSnapshot.captureNormalizedBlock(rawBlock);
    }

    public static async restore(
        snapshot: DeletedBlockTreeSnapshot,
        destination: RestoreBlockTreeDestination
    ): Promise<void> {
        const createdBlockUUIDs: string[] = [];

        try {
            await BlockTreeDeletionSnapshot.restoreInternal(
                snapshot,
                destination,
                createdBlockUUIDs
            );
            await BlockTreeDeletionSnapshot.verifyRestoredTree(snapshot);
        } catch (error) {
            const cleanupErrors =
                await BlockTreeDeletionSnapshot.cleanupCreatedBlocks(createdBlockUUIDs);

            if (cleanupErrors.length > 0 && error instanceof Error) {
                error.message = `${error.message}; cleanup errors: ${cleanupErrors
                    .map((cleanupError) => String(cleanupError))
                    .join(", ")}`;
            }

            throw error;
        }
    }

    private static async captureNormalizedBlock(
        block: BlockEntity
    ): Promise<DeletedBlockTreeSnapshot> {
        const normalizedBlock = await normalizeBlock(block);
        const previousSibling = await logseq.Editor.getPreviousSiblingBlock(normalizedBlock.uuid);
        const nextSibling = await logseq.Editor.getNextSiblingBlock(normalizedBlock.uuid);

        return {
            uuid: normalizedBlock.uuid,
            block: clone(normalizedBlock),
            previousSiblingUuid: previousSibling?.uuid,
            nextSiblingUuid: nextSibling?.uuid,
            children: await Promise.all(
                (normalizedBlock.children ?? [])
                    .filter(isBlockEntity)
                    .map((child) => BlockTreeDeletionSnapshot.captureNormalizedBlock(child))
            )
        };
    }

    private static async restoreInternal(
        snapshot: DeletedBlockTreeSnapshot,
        destination: RestoreBlockTreeDestination,
        createdBlockUUIDs: string[]
    ): Promise<void> {
        const insertedBlock = await BlockTreeDeletionSnapshot.insertBlockSnapshot(
            snapshot,
            destination
        );
        if (!insertedBlock) throw new Error(`Failed to restore block: ${snapshot.uuid}`);

        createdBlockUUIDs.push(snapshot.uuid);
        await BlockTreeDeletionSnapshot.restoreBlockProperties(snapshot);

        for (const child of snapshot.children) {
            await BlockTreeDeletionSnapshot.restoreInternal(
                child,
                {
                    parentUuid: snapshot.uuid,
                    previousSiblingUuid: undefined,
                    nextSiblingUuid: undefined
                },
                createdBlockUUIDs
            );
        }
    }

    private static async insertBlockSnapshot(
        snapshot: DeletedBlockTreeSnapshot,
        destination: RestoreBlockTreeDestination
    ): Promise<BlockEntity | null> {
        const properties = BlockTreeDeletionSnapshot.getRestorableProperties(snapshot.block);
        const options = {
            customUUID: snapshot.uuid,
            properties,
            ...BlockTreeDeletionSnapshot.getInsertPositionOptions(destination)
        };

        return await logseq.Editor.insertBlock(
            BlockTreeDeletionSnapshot.getInsertAnchor(destination),
            snapshot.block.content ?? "",
            options
        );
    }

    private static getInsertAnchor(destination: RestoreBlockTreeDestination): BlockIdentity {
        return (destination.previousSiblingUuid ??
            destination.nextSiblingUuid ??
            destination.parentUuid) as BlockIdentity;
    }

    private static getInsertPositionOptions(destination: RestoreBlockTreeDestination) {
        if (destination.previousSiblingUuid) return {sibling: true};
        if (destination.nextSiblingUuid) return {sibling: true, before: true};
        return {end: true};
    }

    private static async restoreBlockProperties(snapshot: DeletedBlockTreeSnapshot): Promise<void> {
        for (const [key, value] of Object.entries(
            BlockTreeDeletionSnapshot.getRestorableProperties(snapshot.block)
        )) {
            await logseq.Editor.upsertBlockProperty(snapshot.uuid, key, value);
        }
    }

    private static getRestorableProperties(block: BlockEntity): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(block.properties ?? {}).filter(
                ([key]) => !nonRestorablePropertyKeys.has(key)
            )
        );
    }

    private static async verifyRestoredTree(snapshot: DeletedBlockTreeSnapshot): Promise<void> {
        const rawRestoredBlock = await LogseqPropertiesHelper.getBlock(snapshot.uuid, {
            includeChildren: true
        });
        if (!rawRestoredBlock) throw new Error(`Restored block not found: ${snapshot.uuid}`);

        const restoredBlock = await normalizeBlock(rawRestoredBlock);
        BlockTreeDeletionSnapshot.verifyBlock(snapshot, restoredBlock);
    }

    private static verifyBlock(snapshot: DeletedBlockTreeSnapshot, block: BlockEntity): void {
        if (block.uuid !== snapshot.uuid) {
            throw new Error(
                `Restored block UUID mismatch: expected ${snapshot.uuid}, got ${block.uuid}`
            );
        }

        if ((block.content ?? "") !== (snapshot.block.content ?? "")) {
            throw new Error(`Restored block content mismatch: ${snapshot.uuid}`);
        }

        const expectedProperties = BlockTreeDeletionSnapshot.getRestorableProperties(
            snapshot.block
        );
        const restoredProperties = BlockTreeDeletionSnapshot.getRestorableProperties(block);
        for (const [key, expectedValue] of Object.entries(expectedProperties)) {
            if (JSON.stringify(restoredProperties[key]) !== JSON.stringify(expectedValue)) {
                throw new Error(`Restored block property mismatch: ${snapshot.uuid}.${key}`);
            }
        }

        const restoredChildren = (block.children ?? []).filter(isBlockEntity);
        if (restoredChildren.length !== snapshot.children.length) {
            throw new Error(`Restored block child count mismatch: ${snapshot.uuid}`);
        }

        for (const [index, childSnapshot] of snapshot.children.entries()) {
            const child = restoredChildren[index];
            if (!child) throw new Error(`Restored block missing child: ${childSnapshot.uuid}`);
            BlockTreeDeletionSnapshot.verifyBlock(childSnapshot, child);
        }
    }

    private static async cleanupCreatedBlocks(blockUUIDs: string[]): Promise<unknown[]> {
        const cleanupErrors: unknown[] = [];
        for (const blockUUID of blockUUIDs.reverse()) {
            try {
                await logseq.Editor.removeBlock(blockUUID);
            } catch (cleanupError) {
                cleanupErrors.push(cleanupError);
            }
        }

        return cleanupErrors;
    }
}

function isBlockEntity(value: unknown): value is BlockEntity {
    return typeof value === "object" && value !== null && "uuid" in value && "id" in value;
}

function clone<T>(value: T): T {
    return structuredClone(value);
}
