import type {LogseqEntity} from "../types";

export function getEntityName(entity: LogseqEntity, fallback: string): string {
    const record = entity as unknown as Record<string, unknown>;
    const name = record.fullTitle ?? record.title ?? entity.content;
    return typeof name === "string" && name.trim() ? name : fallback;
}
