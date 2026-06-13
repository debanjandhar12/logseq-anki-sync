import type {EntityID, PageEntity, PropertySchema} from "@logseq/libs/dist/LSPlugin";
import type {InMemoryPageEntity, LogseqEntityIdentity} from "../../types";
import {createPropertyPage, createTagPage, TAG_EXTENDS_KEY, TAG_PROPERTIES_KEY} from "./schemaPage";

export interface InMemorySchemaPageLoader {
    loadPropertyPage(keyOrIdentity: LogseqEntityIdentity): Promise<InMemoryPageEntity | null>;
    loadTagPage(nameOrIdentity: LogseqEntityIdentity): Promise<InMemoryPageEntity | null>;
}

export class LogseqInMemorySchemaPageLoader implements InMemorySchemaPageLoader {
    public async loadPropertyPage(
        keyOrIdentity: LogseqEntityIdentity
    ): Promise<InMemoryPageEntity | null> {
        const properties = await this.getProperties();
        const property = properties.find((candidate) =>
            matchesSchemaPageIdentity(candidate, keyOrIdentity, getPropertyKey(candidate))
        );
        if (!property) return null;

        const page = createPropertyPage(
            property.uuid,
            getPropertyKey(property),
            getRecord(property.properties?.[":logseq.property/schema"]) as Partial<PropertySchema>,
            typeof property.title === "string" ? property.title : undefined,
            {...(property.properties || {})},
            property.createdAt
        );
        copyPageIdentityFields(property, page);
        return page;
    }

    public async loadTagPage(
        nameOrIdentity: LogseqEntityIdentity
    ): Promise<InMemoryPageEntity | null> {
        const directIdentity = getStringOrNumericIdentity(nameOrIdentity);
        const directTag =
            directIdentity !== null ? await logseq.Editor.getTag(directIdentity) : null;
        const tag =
            directTag ||
            (await this.getTags()).find((candidate) =>
                matchesSchemaPageIdentity(candidate, nameOrIdentity, candidate.name)
            );
        if (!tag) return null;

        const properties = await this.getProperties();
        const tags = await this.getTags();
        const tagProperties = getIdentityList(
            tag.properties?.[":logseq.property.class/properties"]
        )
            .map((identity) =>
                properties.find((candidate) =>
                    matchesSchemaPageIdentity(candidate, identity, getPropertyKey(candidate))
                )
            )
            .filter((property): property is PageEntity => property !== undefined)
            .map(getPropertyKey);
        const extendsTags = getIdentityList(tag.properties?.[":logseq.property.class/extends"])
            .map((identity) =>
                tags.find((candidate) =>
                    matchesSchemaPageIdentity(candidate, identity, candidate.name)
                )
            )
            .filter((parent): parent is PageEntity => parent !== undefined)
            .map((parent) => parent.name);

        const page = createTagPage(
            tag.uuid,
            tag.name,
            {
                ...(tag.properties || {}),
                [TAG_PROPERTIES_KEY]: tagProperties,
                [TAG_EXTENDS_KEY]: extendsTags
            },
            tag.createdAt
        );
        copyPageIdentityFields(tag, page);
        return page;
    }

    private async getProperties(): Promise<PageEntity[]> {
        return (await logseq.Editor.getAllProperties()) || [];
    }

    private async getTags(): Promise<PageEntity[]> {
        return (await logseq.Editor.getAllTags()) || [];
    }
}

function matchesSchemaPageIdentity(
    entity: PageEntity,
    identity: LogseqEntityIdentity,
    canonicalName: string
): boolean {
    if (typeof identity === "number") return entity.id === identity;
    if (typeof identity === "string") {
        return entity.uuid === identity || canonicalName === identity || entity.ident === identity;
    }
    return entity.uuid === identity.uuid;
}

function getPropertyKey(property: PageEntity): string {
    return property.name || property.originalName || property.ident || property.uuid;
}

function getRecord(value: unknown): Record<string, any> {
    return typeof value === "object" && value !== null ? (value as Record<string, any>) : {};
}

function getIdentityList(value: unknown): Array<string | EntityID> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((identity) => {
        if (typeof identity === "string" || typeof identity === "number") return [identity];
        if (typeof identity === "object" && identity !== null) {
            if ("id" in identity && typeof identity.id === "number") return [identity.id];
            if ("uuid" in identity && typeof identity.uuid === "string") return [identity.uuid];
        }
        return [];
    });
}

function getStringOrNumericIdentity(
    identity: LogseqEntityIdentity
): string | EntityID | null {
    if (typeof identity === "string" || typeof identity === "number") return identity;
    return identity.uuid;
}

function copyPageIdentityFields(source: PageEntity, target: InMemoryPageEntity): void {
    target.id = source.id;
    target.ident = source.ident;
    target.originalName = source.originalName;
    target.updatedAt = source.updatedAt;
}
