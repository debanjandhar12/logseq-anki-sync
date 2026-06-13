import type {InMemoryDB, InMemoryLogseqEntity} from "../../types";

export function removePropertyFromEntities(db: InMemoryDB, key: string): void {
    for (const page of db.values()) {
        removePropertyFromEntityTree(page, key);
    }
}

function removePropertyFromEntityTree(entity: InMemoryLogseqEntity, key: string): void {
    if (entity.properties) {
        delete entity.properties[key];
    }

    for (const child of entity.children || []) {
        removePropertyFromEntityTree(child, key);
    }
}
