import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqBlockPropertyHelper} from "src/logseq/LogseqBlockPropertyHelper";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {AddTagToBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/AddTagToBlockCommand";
import {entityHasReference} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/entityHasReference";

const testId = Date.now();
const pageName = `AddTagToBlockPage_${testId}`;
const tagName = `AddTagToBlockTag_${testId}`;
const propertyKey = `AddTagToBlockProperty_${testId}`;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 350));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const blockTagPropertiesQuery = `
[:find ?property
 :in $ ?block
 :where
 [?block :block/tags ?tag]
 [?tag :logseq.property.class/properties ?property]]
`;

function containsEntityId(value: unknown, entityId: number): boolean {
    if (!Array.isArray(value)) return value === entityId;
    return value.some((item) => containsEntityId(item, entityId));
}

async function blockHasTag(block: BlockEntity, tag: PageEntity): Promise<boolean> {
    const updatedBlock = await logseq.Editor.getBlock(block.uuid);
    return entityHasReference(updatedBlock?.tags, tag);
}

async function blockHasTagProperty(block: BlockEntity, property: BlockEntity): Promise<boolean> {
    const result = await logseq.DB.datascriptQuery(blockTagPropertiesQuery, block.id);
    return containsEntityId(result, property.id);
}

describe("AddTagToBlockCommand args", () => {
    it("requires block and tag page UUIDs", () => {
        expect(
            () =>
                new AddTagToBlockCommand({
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                    tagPageUuid: "Book"
                })
        ).toThrow();
    });
});

describe.skipIf(!shouldRunTests())("AddTagToBlockCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;
    let tag: PageEntity;
    let property: BlockEntity;

    beforeAll(async () => {
        page = (await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        ))!;
        block = (await logseq.Editor.appendBlockInPage(page.uuid, `Tagged block ${testId}`))!;
        tag = (await logseq.Editor.createTag(tagName))!;
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        property = (await logseq.Editor.getProperty(propertyKey))!;
        await logseq.Editor.addTagProperty(tag.uuid, property.uuid);
        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (await logseq.Editor.getProperty(propertyKey)) {
            await logseq.Editor.removeProperty(propertyKey);
        }
        await logseq.Editor.deletePage(tag.uuid);
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("adds a block tag and removes it on revert", async () => {
        await logseq.Editor.removeBlockTag(block.uuid, tag.uuid);
        expect(await blockHasTagProperty(block, property)).toBe(false);
        const command = new AddTagToBlockCommand({
            blockUuid: block.uuid,
            tagPageUuid: tag.uuid
        });

        await command.execute();
        expect(command.getChangedPages()).toEqual([page.uuid]);
        expect(await blockHasTag(block, tag)).toBe(true);
        expect(await blockHasTagProperty(block, property)).toBe(true);

        await command.revert();
        expect(await blockHasTag(block, tag)).toBe(false);
        expect(await blockHasTagProperty(block, property)).toBe(false);
    }, 60_000);

    it("preserves a valued property on revert", async () => {
        await logseq.Editor.removeBlockTag(block.uuid, tag.uuid);
        await logseq.Editor.upsertBlockProperty(block.uuid, propertyKey, "existing value", {
            reset: true
        });
        const command = new AddTagToBlockCommand({
            blockUuid: block.uuid,
            tagPageUuid: tag.uuid
        });

        await command.execute();
        await command.revert();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("existing value");
        await logseq.Editor.removeBlockProperty(block.uuid, propertyKey);
    }, 60_000);

    it("throws when the block already has the tag", async () => {
        await logseq.Editor.removeBlockTag(block.uuid, tag.uuid);
        await logseq.Editor.addBlockTag(block.uuid, tag.uuid);
        const command = new AddTagToBlockCommand({
            blockUuid: block.uuid,
            tagPageUuid: tag.uuid
        });

        await expect(command.execute()).rejects.toThrow(`Block already has tag: ${tag.uuid}`);
        await logseq.Editor.removeBlockTag(block.uuid, tag.uuid);
    }, 60_000);
});
