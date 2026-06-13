import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import type {InMemoryPageEntity} from "../../types";
import {createInMemoryPage} from "./entityFactory";

export const PROPERTY_SCHEMA_KEY = ":logseq.property/schema";
export const TAG_PROPERTIES_KEY = ":logseq.property.class/properties";
export const TAG_EXTENDS_KEY = ":logseq.property.class/extends";

export function createPropertyPage(
    uuid: string,
    key: string,
    schema: Partial<PropertySchema>,
    displayName: string | undefined,
    properties: Record<string, any>,
    now: number
): InMemoryPageEntity {
    const page = createInMemoryPage(
        uuid,
        key,
        {...properties, [PROPERTY_SCHEMA_KEY]: {...schema}},
        now,
        "property"
    );
    if (displayName !== undefined) {
        page.title = displayName;
        page.fullTitle = displayName;
        page.content = displayName;
    }
    return page;
}

export function createTagPage(
    uuid: string,
    name: string,
    properties: Record<string, any>,
    now: number
): InMemoryPageEntity {
    return createInMemoryPage(
        uuid,
        name,
        {
            ...properties,
            [TAG_PROPERTIES_KEY]: getStringList(properties[TAG_PROPERTIES_KEY]),
            [TAG_EXTENDS_KEY]: getStringList(properties[TAG_EXTENDS_KEY])
        },
        now,
        "class"
    );
}

export function isPropertyPage(page: InMemoryPageEntity): boolean {
    return page.pageType === "property";
}

export function isTagPage(page: InMemoryPageEntity): boolean {
    return page.pageType === "class";
}

export function isSchemaPage(page: InMemoryPageEntity): boolean {
    return isPropertyPage(page) || isTagPage(page);
}

export function getPropertySchema(
    page: InMemoryPageEntity | null | undefined
): Partial<PropertySchema> {
    return getRecord(page?.properties?.[PROPERTY_SCHEMA_KEY]) as Partial<PropertySchema>;
}

export function setPropertySchema(
    page: InMemoryPageEntity,
    schema: Partial<PropertySchema>
): void {
    getMutableProperties(page)[PROPERTY_SCHEMA_KEY] = {...schema};
}

export function getTagPropertyKeys(page: InMemoryPageEntity | null | undefined): string[] {
    return getStringList(page?.properties?.[TAG_PROPERTIES_KEY]);
}

export function setTagPropertyKeys(page: InMemoryPageEntity, keys: string[]): void {
    getMutableProperties(page)[TAG_PROPERTIES_KEY] = [...keys];
}

export function getTagExtends(page: InMemoryPageEntity | null | undefined): string[] {
    return getStringList(page?.properties?.[TAG_EXTENDS_KEY]);
}

export function setTagExtends(page: InMemoryPageEntity, tagNames: string[]): void {
    getMutableProperties(page)[TAG_EXTENDS_KEY] = [...tagNames];
}

function getMutableProperties(page: InMemoryPageEntity): Record<string, any> {
    page.properties = page.properties || {};
    return page.properties;
}

function getRecord(value: unknown): Record<string, any> {
    return typeof value === "object" && value !== null ? (value as Record<string, any>) : {};
}

function getStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}
