import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {RemovePropertyFromTagPageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/RemovePropertyFromTagPageCommand";
import {entityHasReference} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/entityHasReference";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const tagName = "test-remove-property-from-tag-page-command-tag";
const propertyKey = "test-remove-property-from-tag-page-command-property";

async function tagHasProperty(tag: PageEntity, property: BlockEntity): Promise<boolean> {
    const updatedTag = (await logseq.Editor.getTag(tag.uuid)) as unknown as Record<string, unknown>;
    return entityHasReference(updatedTag[":logseq.property.class/properties"], property);
}

describe("RemovePropertyFromTagPageCommand args", () => {
    it("requires tag and property page UUIDs", () => {
        expect(
            () =>
                new RemovePropertyFromTagPageCommand({
                    tagPageUuid: "Book",
                    propertyPageUuid: "018f38a5-df13-74d1-bf02-14c17f252f30"
                })
        ).toThrow();
    });
});

// Skipped: Logseq's tag-property API rejects valid tags with "Not a valid tag".
describe.skip("RemovePropertyFromTagPageCommand", () => {
    let tag: PageEntity;
    let property: BlockEntity;

    beforeAll(async () => {
        await deletePagePermanently(tagName);
        await deletePagePermanently(propertyKey);
        tag = (await logseq.Editor.createTag(tagName))!;
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        property = (await logseq.Editor.getProperty(propertyKey))!;
    }, 60_000);

    afterAll(async () => {
        await deletePagePermanently(tagName);
        await deletePagePermanently(propertyKey);
    }, 60_000);

    it("removes a tag property and restores it on revert", async () => {
        await logseq.Editor.addTagProperty(tag.uuid, property.uuid);
        const command = new RemovePropertyFromTagPageCommand({
            tagPageUuid: tag.uuid,
            propertyPageUuid: property.uuid
        });

        await command.execute();
        expect(command.getChangedPages()).toEqual([tag.uuid]);
        expect(await tagHasProperty(tag, property)).toBe(false);

        await command.revert();
        expect(await tagHasProperty(tag, property)).toBe(true);
        await logseq.Editor.removeTagProperty(tag.uuid, property.uuid);
    }, 60_000);

    it("throws when the tag does not have the property", async () => {
        const command = new RemovePropertyFromTagPageCommand({
            tagPageUuid: tag.uuid,
            propertyPageUuid: property.uuid
        });

        await expect(command.execute()).rejects.toThrow(
            `Tag page does not have property: ${property.uuid}`
        );
    }, 60_000);
});
