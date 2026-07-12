import type {EntityID} from "@logseq/libs/dist/LSPlugin";

/**
 * Utility method to safely get entity id
 */
export function getEntityID(value: unknown): EntityID | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "object" && value !== null && "id" in value) {
        const id = (value as {id: EntityID}).id;
        if (typeof id === "number") return id;
    }

    return undefined;
}
