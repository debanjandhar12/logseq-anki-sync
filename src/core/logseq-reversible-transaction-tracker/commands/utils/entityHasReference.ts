import {getEntityID} from "./getEntityID";

type ReferencedEntity = {
    id?: number;
    uuid?: string;
};

export function entityHasReference(references: unknown, target: ReferencedEntity): boolean {
    if (!Array.isArray(references)) return false;

    return references.some((reference) => {
        if (typeof reference === "object" && reference !== null) {
            const record = reference as ReferencedEntity;
            if (target.uuid && record.uuid === target.uuid) return true;
        }

        const referenceId = getEntityID(reference);
        return target.id !== undefined && referenceId === target.id;
    });
}
