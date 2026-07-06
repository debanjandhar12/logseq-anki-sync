import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import type {LogseqEditor} from "src/logseq/LogseqEditor";

export type PagePropertiesSchemaSnapshot = {
    propertyIndent: string;
    propertyIdent: string | undefined;
    schema: Partial<PropertySchema> | undefined;
    opts: {name?: string} | undefined;
    property: NonNullable<Awaited<ReturnType<typeof LogseqEditor.getProperty>>>;
};

type PropertyEntity = NonNullable<Awaited<ReturnType<typeof LogseqEditor.getProperty>>>;

function getStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value;
    }

    return undefined;
}

function normalizeKeywordString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    return value.replace(/^:/, "");
}

function getPropertyIndent(record: Record<string, unknown>): string | undefined {
    const ident = getStringField(record, ["ident", "db/ident", ":db/ident"]);
    if (ident?.includes("/")) return ident.replace(/^:/, "").split("/").at(-1);

    return getStringField(record, [
        "name",
        "block/name",
        ":block/name",
        "originalName",
        "title",
        "block/title",
        ":block/title",
        "content",
        "fullTitle",
        "ident",
        "db/ident",
        ":db/ident"
    ]);
}

function normalizeCardinality(value: unknown): "one" | "many" | undefined {
    const normalized = normalizeKeywordString(value);
    if (!normalized) return undefined;
    if (normalized === "one" || normalized === "db.cardinality/one") return "one";
    if (normalized === "many" || normalized === "db.cardinality/many") return "many";
    return undefined;
}

export function snapshotPagePropertiesSchema(
    property: PropertyEntity
): PagePropertiesSchemaSnapshot {
    const record = property as unknown as Record<string, unknown>;
    const propertyIndent = getPropertyIndent(record);
    if (!propertyIndent) throw new Error("Unable to resolve property indent from property page");
    const propertyIdent = getStringField(record, ["ident", "db/ident", ":db/ident"]);

    const schema: Partial<PropertySchema> = {};
    const type = normalizeKeywordString(
        record.type ?? record["logseq.property/type"] ?? record[":logseq.property/type"]
    );
    if (type) schema.type = type;

    const cardinality = normalizeCardinality(
        record.cardinality ?? record["db/cardinality"] ?? record[":db/cardinality"]
    );
    if (cardinality) schema.cardinality = cardinality;

    const hide = record.hide ?? record["hide?"] ?? record["logseq.property/hide?"];
    if (typeof hide === "boolean") schema.hide = hide;

    const isPublic = record.public ?? record["public?"] ?? record["logseq.property/public?"];
    if (typeof isPublic === "boolean") schema.public = isPublic;

    const name = getStringField(record, ["title", "originalName", "name", "content", "fullTitle"]);

    return {
        propertyIndent,
        propertyIdent,
        schema: Object.keys(schema).length > 0 ? schema : undefined,
        opts: name ? {name} : undefined,
        property
    };
}
