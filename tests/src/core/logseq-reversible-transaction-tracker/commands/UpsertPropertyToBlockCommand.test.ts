import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {UpsertPropertyToBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker";
import {LogseqBlockPropertyHelper} from "../../../../../src/logseq/LogseqBlockPropertyHelper";

const testId = Date.now();
const pageName = `UpsertPropertyToBlockPage_${testId}`;
const propertyKey = `UpsertPropertyToBlock_${testId}`;
const propertyKeysToCleanUp = new Set<string>([propertyKey]);
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 350));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

type PropertySchema = Parameters<typeof logseq.Editor.upsertProperty>[1];
type JournalPage = PageEntity & {title?: string; originalName?: string};

const journalPageByDayQuery = `
[:find (pull ?p [:db/id :block/uuid :block/title :block/original-name])
 :in $ ?journal-day
 :where
 [?p :block/journal-day ?journal-day]]
`;

function flatEntities(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value))
        return typeof value === "object" && value ? [value as Record<string, unknown>] : [];
    return value.flatMap(flatEntities);
}

function entityIdOf(entity: Record<string, unknown>): number | undefined {
    const value = entity["db/id"] ?? entity.id;
    return typeof value === "number" ? value : undefined;
}

function titleOf(entity: Record<string, unknown>): string | undefined {
    const value = entity["block/title"] ?? entity.title ?? entity["block/original-name"];
    return typeof value === "string" ? value : undefined;
}

describe("UpsertPropertyToBlockCommand args", () => {
    it("requires a property UUID or indent", () => {
        expect(
            () =>
                new UpsertPropertyToBlockCommand({
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f37",
                    value: "x"
                } as never)
        ).toThrow();
        expect(
            () =>
                new UpsertPropertyToBlockCommand({
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f37",
                    propertyUuidOrIndent: "deck",
                    value: "x"
                })
        ).not.toThrow();
    });
});

describe.skipIf(!shouldRunTests())("UpsertPropertyToBlockCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;
    let propertyPage: BlockEntity;
    let nodePage: PageEntity;
    let updatedNodePage: PageEntity;

    const createProperty = async (key: string, schema: PropertySchema) => {
        propertyKeysToCleanUp.add(key);
        await logseq.Editor.upsertProperty(key, schema);
        await waitForLogseqDb();

        const property = await logseq.Editor.getProperty(key);
        if (!property) throw new Error(`Property not found: ${key}`);

        return property;
    };

    const getJournalPageByDay = async (journalDay: number): Promise<JournalPage> => {
        const result = await logseq.DB.datascriptQuery(journalPageByDayQuery, journalDay);
        const entity = flatEntities(result)[0] ?? {};
        const id = entityIdOf(entity);
        const title = titleOf(entity);
        if (!id || !title) throw new Error(`Journal page not found for day ${journalDay}`);

        return {id, title} as JournalPage;
    };

    const expectExecuteAndRevert = async ({
        propertyKey: targetPropertyKey,
        propertyUuidOrIndent,
        oldValue,
        updatedValue,
        expectedOldValue = oldValue,
        expectedUpdatedValue = updatedValue
    }: {
        propertyKey: string;
        propertyUuidOrIndent: string;
        oldValue: unknown;
        updatedValue: unknown;
        expectedOldValue?: unknown;
        expectedUpdatedValue?: unknown;
    }) => {
        await logseq.Editor.upsertBlockProperty(block.uuid, targetPropertyKey, oldValue, {
            reset: true
        });
        await waitForLogseqDb();

        const command = new UpsertPropertyToBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent,
            value: updatedValue
        });

        await command.execute();
        await waitForLogseqDb();
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, targetPropertyKey)
        ).resolves.toEqual(expectedUpdatedValue);

        await command.revert();
        await waitForLogseqDb();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, targetPropertyKey)
        ).resolves.toEqual(expectedOldValue);
        await logseq.Editor.removeBlockProperty(block.uuid, targetPropertyKey);
    };

    beforeAll(async () => {
        if (await logseq.Editor.getProperty(propertyKey)) {
            await logseq.Editor.removeProperty(propertyKey);
            await waitForLogseqDb();
        }

        page =
            (await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: false}
            )) ?? (await logseq.Editor.getPage(pageName))!;
        await waitForLogseqDb();
        nodePage =
            (await logseq.Editor.createPage(
                `${pageName}_Node`,
                {},
                {
                    redirect: false,
                    createFirstBlock: false
                }
            )) ?? (await logseq.Editor.getPage(`${pageName}_Node`))!;
        updatedNodePage =
            (await logseq.Editor.createPage(
                `${pageName}_UpdatedNode`,
                {},
                {
                    redirect: false,
                    createFirstBlock: false
                }
            )) ?? (await logseq.Editor.getPage(`${pageName}_UpdatedNode`))!;
        await waitForLogseqDb();
        block = (await logseq.Editor.appendBlockInPage(page.uuid, `Upsert block ${testId}`))!;
        await waitForLogseqDb();
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        propertyPage = (await logseq.Editor.getProperty(propertyKey))!;
        await waitForLogseqDb();
    }, 120_000);

    afterAll(async () => {
        for (const key of propertyKeysToCleanUp) {
            if (await logseq.Editor.getProperty(key)) await logseq.Editor.removeProperty(key);
        }
        await logseq.Editor.deletePage(`${pageName}_UpdatedNode`);
        await logseq.Editor.deletePage(`${pageName}_Node`);
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 180_000);

    it("execute and revert works with property uuid", async () => {
        await logseq.Editor.upsertBlockProperty(block.uuid, propertyKey, "old value", {
            reset: true
        });
        await waitForLogseqDb();

        const command = new UpsertPropertyToBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent: propertyPage.uuid,
            value: "updated value"
        });

        await command.execute();
        await waitForLogseqDb();
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("updated value");

        await command.revert();
        await waitForLogseqDb();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("old value");
        await logseq.Editor.removeBlockProperty(block.uuid, propertyKey);
    }, 180_000);

    it("execute and revert works with property indent", async () => {
        await expectExecuteAndRevert({
            propertyKey,
            propertyUuidOrIndent: propertyKey,
            oldValue: "old indent value",
            updatedValue: "updated indent value"
        });
    }, 60_000);

    it("records the page when adding a property to its page block", async () => {
        const command = new UpsertPropertyToBlockCommand({
            blockUuid: page.uuid,
            propertyUuidOrIndent: propertyKey,
            value: "page property value"
        });

        await command.execute();
        await waitForLogseqDb();

        expect(command.getChangedPages()).toEqual([page.uuid]);
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(page.uuid, propertyKey)
        ).resolves.toBe("page property value");

        await command.revert();
        await waitForLogseqDb();
    }, 60_000);

    it("execute and revert works on many cardinality default property", async () => {
        const targetPropertyKey = `${propertyKey}_many_default`;
        const property = await createProperty(targetPropertyKey, {
            type: "default",
            cardinality: "many"
        });

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: ["old one", "old two"],
            updatedValue: ["updated one", "updated two"],
            expectedOldValue: [expect.any(Number), expect.any(Number)],
            expectedUpdatedValue: [expect.any(Number), expect.any(Number)]
        });
    }, 60_000);

    it("execute and revert works on number property", async () => {
        const targetPropertyKey = `${propertyKey}_number`;
        const property = await createProperty(targetPropertyKey, {
            type: "number",
            cardinality: "one"
        });

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: 12,
            updatedValue: 34
        });
    }, 60_000);

    it("execute and revert works on date property", async () => {
        const targetPropertyKey = `${propertyKey}_date`;
        const property = await createProperty(targetPropertyKey, {
            type: "date",
            cardinality: "one"
        });
        const oldJournalDay = 20990116;
        const updatedJournalDay = 20990117;
        await logseq.Editor.createJournalPage(new Date(2099, 0, 16));
        await logseq.Editor.createJournalPage(new Date(2099, 0, 17));
        await waitForLogseqDb();
        const oldJournalPage = await getJournalPageByDay(oldJournalDay);
        const updatedJournalPage = await getJournalPageByDay(updatedJournalDay);

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: oldJournalPage.id,
            updatedValue: updatedJournalPage.id,
            expectedOldValue: oldJournalPage.title,
            expectedUpdatedValue: updatedJournalPage.title
        });
    }, 180_000);

    it("execute and revert works on Checkbox property", async () => {
        const targetPropertyKey = `${propertyKey}_checkbox`;
        const property = await createProperty(targetPropertyKey, {
            type: "checkbox",
            cardinality: "one"
        });

        await logseq.Editor.upsertBlockProperty(block.uuid, targetPropertyKey, true, {
            reset: true
        });
        await waitForLogseqDb();

        const command = new UpsertPropertyToBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent: property.uuid,
            value: false
        });

        await command.execute();
        await waitForLogseqDb();
        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, targetPropertyKey)
        ).resolves.toBeNull();

        await command.revert();
        await waitForLogseqDb();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, targetPropertyKey)
        ).resolves.toBe(true);
        await logseq.Editor.removeBlockProperty(block.uuid, targetPropertyKey);
    }, 60_000);

    it("execute and revert works on Node property", async () => {
        const targetPropertyKey = `${propertyKey}_node`;
        const property = await createProperty(targetPropertyKey, {
            type: "node",
            cardinality: "one"
        });

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: nodePage.id,
            updatedValue: updatedNodePage.id,
            expectedOldValue: `${pageName}_Node`,
            expectedUpdatedValue: `${pageName}_UpdatedNode`
        });
    }, 60_000);

    it("execute and revert works on many cardinality Node property", async () => {
        const targetPropertyKey = `${propertyKey}_many_node`;
        const property = await createProperty(targetPropertyKey, {
            type: "node",
            cardinality: "many"
        });

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: [nodePage.id],
            updatedValue: [updatedNodePage.id],
            expectedOldValue: [nodePage.id],
            expectedUpdatedValue: [updatedNodePage.id]
        });
    }, 60_000);

    it("execute and revert works on Url property", async () => {
        const targetPropertyKey = `${propertyKey}_url`;
        const property = await createProperty(targetPropertyKey, {
            type: "url",
            cardinality: "one"
        });

        await expectExecuteAndRevert({
            propertyKey: targetPropertyKey,
            propertyUuidOrIndent: property.uuid,
            oldValue: "https://example.com/old",
            updatedValue: "https://example.com/updated"
        });
    }, 60_000);
});
