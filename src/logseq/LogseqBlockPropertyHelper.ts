import type {BlockIdentity, EntityID} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "./LogseqEditor";

export class LogseqBlockPropertyNotFoundError extends Error {
    public constructor(propertyIndent: string) {
        super(`Block property not found: ${propertyIndent}`);
    }
}

export class LogseqBlockPropertyHelper {
    public static async getBlockProperty(
        block: BlockIdentity | EntityID,
        propertyIndent: string
    ): Promise<unknown> {
        const property = await LogseqEditor.getProperty(propertyIndent);
        if (!property) throw new Error(`Property not found: ${propertyIndent}`);

        const blockProperties = await logseq.Editor.getBlockProperties(block);
        if (!LogseqBlockPropertyHelper.hasProperty(blockProperties, property, propertyIndent)) {
            throw new LogseqBlockPropertyNotFoundError(propertyIndent);
        }

        const value = await logseq.Editor.getBlockProperty(block, propertyIndent);
        if (LogseqBlockPropertyHelper.isManyCardinality(property)) {
            return Array.isArray(value)
                ? value.map(LogseqBlockPropertyHelper.normalizePropertyValue)
                : [LogseqBlockPropertyHelper.normalizePropertyValue(value)];
        }

        return LogseqBlockPropertyHelper.normalizePropertyValue(value);
    }

    private static hasProperty(
        blockProperties: Record<string, unknown> | null,
        property: NonNullable<Awaited<ReturnType<typeof LogseqEditor.getProperty>>>,
        propertyIndent: string
    ): boolean {
        if (!blockProperties) return false;

        const candidates = new Set<string>([propertyIndent, propertyIndent.replace(/^:/, "")]);
        const record = property as unknown as Record<string, unknown>;
        for (const key of ["ident", "name", "originalName", "title", "content", "fullTitle"]) {
            const value = record[key];
            if (typeof value === "string" && value.trim()) candidates.add(value);
        }

        return Object.keys(blockProperties).some((key) => candidates.has(key));
    }

    private static isManyCardinality(
        property: NonNullable<Awaited<ReturnType<typeof LogseqEditor.getProperty>>>
    ): boolean {
        const record = property as unknown as Record<string, unknown>;
        const cardinality =
            record.cardinality ?? record["db/cardinality"] ?? record[":db/cardinality"];
        return typeof cardinality === "string" && cardinality.includes("many");
    }

    private static normalizePropertyValue(value: unknown): unknown {
        if (typeof value !== "object" || value === null || !("id" in value)) return value;

        const record = value as Record<string, unknown>;
        return record.value ?? record.content ?? record.title ?? record.fullTitle;
    }
}
