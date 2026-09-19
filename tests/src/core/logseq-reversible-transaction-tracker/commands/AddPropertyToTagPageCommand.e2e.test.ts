import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {AddPropertyToTagPageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/AddPropertyToTagPageCommand";
import {entityHasReference} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/entityHasReference";

const testId = Date.now();
const tagName = `AddPropertyToTagPageTag_${testId}`;
const propertyKey = `AddPropertyToTagPageProperty_${testId}`;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 350));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

async function tagHasProperty(tag: PageEntity, property: BlockEntity): Promise<boolean> {
    const updatedTag = (await logseq.Editor.getTag(tag.uuid)) as unknown as Record<string, unknown>;
    return entityHasReference(updatedTag[":logseq.property.class/properties"], property);
}

describe("AddPropertyToTagPageCommand args", () => {
    it("requires tag and property page UUIDs", () => {
        expect(
            () =>
                new AddPropertyToTagPageCommand({
                    tagPageUuid: "Book",
                    propertyPageUuid: "018f38a5-df13-74d1-bf02-14c17f252f30"
                })
        ).toThrow();
    });
});

describe.skipIf(!shouldRunTests())("AddPropertyToTagPageCommand", () => {
    let tag: PageEntity;
    let property: BlockEntity;

    beforeAll(async () => {
        tag = (await logseq.Editor.createTag(tagName))!;
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        property = (await logseq.Editor.getProperty(propertyKey))!;
        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (await logseq.Editor.getProperty(propertyKey)) {
            await logseq.Editor.removeProperty(propertyKey);
        }
        await logseq.Editor.deletePage(tag.uuid);
        await waitForLogseqDb();
    }, 60_000);

    it("adds a tag property and removes it on revert", async () => {
        const command = new AddPropertyToTagPageCommand({
            tagPageUuid: tag.uuid,
            propertyPageUuid: property.uuid
        });

        await command.execute();
        expect(command.getChangedPages()).toEqual([tag.uuid]);
        expect(await tagHasProperty(tag, property)).toBe(true);

        await command.revert();
        expect(await tagHasProperty(tag, property)).toBe(false);
    }, 60_000);

    it("throws when the tag already has the property", async () => {
        await logseq.Editor.addTagProperty(tag.uuid, property.uuid);
        const command = new AddPropertyToTagPageCommand({
            tagPageUuid: tag.uuid,
            propertyPageUuid: property.uuid
        });

        await expect(command.execute()).rejects.toThrow(
            `Tag page already has property: ${property.uuid}`
        );
        await logseq.Editor.removeTagProperty(tag.uuid, property.uuid);
    }, 60_000);
});
