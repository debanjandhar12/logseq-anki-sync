import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import BLOCK_PROPERTIES_MAP_FAILS from "../../../../src/chat-app/prompts/queries/BLOCK_PROPERTIES_MAP_FAILS.ds?raw";
import BLOCK_SCHEDULED_FAILS from "../../../../src/chat-app/prompts/queries/BLOCK_SCHEDULED_FAILS.ds?raw";
import CASE_INSENSITIVE_TITLE_SEARCH from "../../../../src/chat-app/prompts/queries/CASE_INSENSITIVE_TITLE_SEARCH.ds?raw";
import COMPLEX_ACTIONABLE_TASK_SEARCH from "../../../../src/chat-app/prompts/queries/COMPLEX_ACTIONABLE_TASK_SEARCH.ds?raw";
import FILE_GRAPH_BLOCK_CONTENT_FAILS from "../../../../src/chat-app/prompts/queries/FILE_GRAPH_BLOCK_CONTENT_FAILS.ds?raw";
import JOURNAL_PAGES_IN_RANGE from "../../../../src/chat-app/prompts/queries/JOURNAL_PAGES_IN_RANGE.ds?raw";
import MIXED_PROPERTY_TYPES_AND_TITLE_SEARCH from "../../../../src/chat-app/prompts/queries/MIXED_PROPERTY_TYPES_AND_TITLE_SEARCH.ds?raw";
import OR_VARIABLE_MISMATCH_FAILS from "../../../../src/chat-app/prompts/queries/OR_VARIABLE_MISMATCH_FAILS.ds?raw";
import PAGE_BY_NAME from "../../../../src/chat-app/prompts/queries/PAGE_BY_NAME.ds?raw";
import PAGE_REFERENCE_BACKLINKS from "../../../../src/chat-app/prompts/queries/PAGE_REFERENCE_BACKLINKS.ds?raw";
import PROPERTY_NODE_LIST_ANY from "../../../../src/chat-app/prompts/queries/PROPERTY_NODE_LIST_ANY.ds?raw";
import PUBLIC_PROPERTY_SCHEMAS from "../../../../src/chat-app/prompts/queries/PUBLIC_PROPERTY_SCHEMAS.ds?raw";
import TAG_IDENT_MATCH from "../../../../src/chat-app/prompts/queries/TAG_IDENT_MATCH.ds?raw";
import TAG_OR_CHILD_TAG_MATCH from "../../../../src/chat-app/prompts/queries/TAG_OR_CHILD_TAG_MATCH.ds?raw";
import TAG_TEXT_SEARCH_FAILS from "../../../../src/chat-app/prompts/queries/TAG_TEXT_SEARCH_FAILS.ds?raw";
import TASKS_BY_STATUS_OR_IMPLICIT_TODO from "../../../../src/chat-app/prompts/queries/TASKS_BY_STATUS_OR_IMPLICIT_TODO.ds?raw";
import TASKS_PRIORITY_NOT_ARCHIVED from "../../../../src/chat-app/prompts/queries/TASKS_PRIORITY_NOT_ARCHIVED.ds?raw";
import TASKS_SCHEDULED_IN_RANGE from "../../../../src/chat-app/prompts/queries/TASKS_SCHEDULED_IN_RANGE.ds?raw";

type PulledEntity = Record<string, unknown>;
type PropertyEntity = BlockEntity & {ident?: string};

const testId = Date.now();
const pageName = `SkillQueryRegression_${testId}`;
const parentTagName = `SkillQueryParentTag_${testId}`;
const childTagName = `SkillQueryChildTag_${testId}`;
const archivedTagName = `SkillQueryArchived_${testId}`;
const checkedPropertyKey = `skill_query_checked_${testId}`;
const numberPropertyKey = `skill_query_score_${testId}`;
const nodePropertyKey = `skill_query_node_${testId}`;
const priorityPropertyKey = `skill_query_priority_${testId}`;
const scheduledPropertyKey = `skill_query_scheduled_${testId}`;
const scheduledDay = 20990115;
const scheduledDate = new Date(2099, 0, 15);
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 700));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

function ednString(value: string): string {
    return JSON.stringify(value);
}

function uuidOf(entity: PulledEntity): string | undefined {
    return (entity[":block/uuid"] ?? entity["block/uuid"] ?? entity.uuid) as string | undefined;
}

function idOf(entity: PulledEntity): number | undefined {
    return (entity[":db/id"] ?? entity["db/id"] ?? entity.id) as number | undefined;
}

function titleOf(entity: PulledEntity): string | undefined {
    return (entity[":block/title"] ?? entity["block/title"] ?? entity.title) as string | undefined;
}

function flatEntities(result: unknown): PulledEntity[] {
    return (result as Array<[PulledEntity]>).map(([entity]) => entity);
}

function hasEntityWithUuid(result: unknown, uuid: string): boolean {
    return flatEntities(result).some((entity) => uuidOf(entity) === uuid);
}

function expectEntityWithUuid(result: unknown, uuid: string): void {
    expect(hasEntityWithUuid(result, uuid)).toBe(true);
}

async function createTag(name: string): Promise<PageEntity> {
    return (await logseq.Editor.createTag(name)) ?? (await logseq.Editor.getTag(name))!;
}

async function getPropertyIdent(propertyKey: string): Promise<string> {
    const property = (await logseq.Editor.getProperty(propertyKey)) as PropertyEntity | null;
    if (!property?.ident) throw new Error(`Property ident not found for ${propertyKey}`);
    return property.ident;
}

async function getJournalPageByDay(journalDay: number): Promise<PageEntity> {
    const result = await logseq.DB.datascriptQuery(
        JOURNAL_PAGES_IN_RANGE,
        String(journalDay),
        String(journalDay)
    );
    const entity = flatEntities(result)[0] ?? {};
    const uuid = uuidOf(entity);
    const id = idOf(entity);
    if (!uuid || !id) throw new Error(`Journal page not found for day ${journalDay}`);
    return {id, uuid} as PageEntity;
}

describe.skipIf(!shouldRunTests())("Datascript queries documented in skill files", () => {
    let page: PageEntity;
    let parentTag: PageEntity;
    let childTag: PageEntity;
    let archivedTag: PageEntity;
    let journalPage: PageEntity;
    let titleBlock: BlockEntity;
    let backlinkBlock: BlockEntity;
    let parentTaggedBlock: BlockEntity;
    let childTaggedBlock: BlockEntity;
    let actionableTaskBlock: BlockEntity;
    let archivedTaskBlock: BlockEntity;
    let checkedPropertyIdent: string;
    let numberPropertyIdent: string;
    let nodePropertyIdent: string;
    let priorityPropertyIdent: string;
    let scheduledPropertyIdent: string;

    beforeAll(async () => {
        page =
            (await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: false}
            )) ?? (await logseq.Editor.getPage(pageName))!;
        titleBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `Skill Query Mixed Case Keyword ${testId}`
        ))!;
        backlinkBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `References [[${pageName}]] for query tests`
        ))!;
        parentTaggedBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `Parent tagged query block ${testId}`
        ))!;
        childTaggedBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `Child tagged query block ${testId}`
        ))!;
        actionableTaskBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `Launch actionable task ${testId}`
        ))!;
        archivedTaskBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            `Launch archived task ${testId}`
        ))!;

        await logseq.Editor.createJournalPage(scheduledDate);
        journalPage = await getJournalPageByDay(scheduledDay);

        parentTag = await createTag(parentTagName);
        childTag = await createTag(childTagName);
        archivedTag = await createTag(archivedTagName);
        await logseq.Editor.addTagExtends(childTag.uuid, parentTag.uuid);
        await logseq.Editor.addBlockTag(parentTaggedBlock.uuid, parentTag.uuid);
        await logseq.Editor.addBlockTag(childTaggedBlock.uuid, childTag.uuid);

        const taskTag =
            (await logseq.Editor.createTag("Task")) ?? (await logseq.Editor.getTag("Task"))!;
        await logseq.Editor.addBlockTag(actionableTaskBlock.uuid, taskTag.uuid);
        await logseq.Editor.addBlockTag(archivedTaskBlock.uuid, taskTag.uuid);
        await logseq.Editor.addBlockTag(archivedTaskBlock.uuid, archivedTag.uuid);

        await logseq.Editor.upsertProperty(checkedPropertyKey, {
            type: "checkbox",
            cardinality: "one"
        });
        await logseq.Editor.upsertProperty(numberPropertyKey, {type: "number", cardinality: "one"});
        await logseq.Editor.upsertProperty(nodePropertyKey, {type: "node", cardinality: "many"});
        await logseq.Editor.upsertProperty(priorityPropertyKey, {type: "node", cardinality: "one"});
        await logseq.Editor.upsertProperty(scheduledPropertyKey, {
            type: "node",
            cardinality: "one"
        });

        checkedPropertyIdent = await getPropertyIdent(checkedPropertyKey);
        numberPropertyIdent = await getPropertyIdent(numberPropertyKey);
        nodePropertyIdent = await getPropertyIdent(nodePropertyKey);
        priorityPropertyIdent = await getPropertyIdent(priorityPropertyKey);
        scheduledPropertyIdent = await getPropertyIdent(scheduledPropertyKey);

        await logseq.Editor.upsertBlockProperty(
            actionableTaskBlock.uuid,
            checkedPropertyKey,
            true,
            {
                reset: true
            }
        );
        await logseq.Editor.upsertBlockProperty(actionableTaskBlock.uuid, numberPropertyKey, 91, {
            reset: true
        });
        await logseq.Editor.upsertBlockProperty(
            actionableTaskBlock.uuid,
            nodePropertyKey,
            [page.id],
            {
                reset: true
            }
        );
        await logseq.Editor.upsertBlockProperty(
            actionableTaskBlock.uuid,
            priorityPropertyKey,
            page.id,
            {reset: true}
        );
        await logseq.Editor.upsertBlockProperty(
            actionableTaskBlock.uuid,
            scheduledPropertyKey,
            journalPage.id,
            {reset: true}
        );
        await logseq.Editor.upsertBlockProperty(
            archivedTaskBlock.uuid,
            priorityPropertyKey,
            page.id,
            {reset: true}
        );
        await logseq.Editor.upsertBlockProperty(
            archivedTaskBlock.uuid,
            scheduledPropertyKey,
            journalPage.id,
            {reset: true}
        );
        await logseq.Editor.upsertBlockProperty(
            archivedTaskBlock.uuid,
            nodePropertyKey,
            [page.id],
            {
                reset: true
            }
        );

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        for (const propertyKey of [
            checkedPropertyKey,
            numberPropertyKey,
            nodePropertyKey,
            priorityPropertyKey,
            scheduledPropertyKey
        ]) {
            if (await logseq.Editor.getProperty(propertyKey))
                await logseq.Editor.removeProperty(propertyKey);
        }

        for (const tag of [parentTag, childTag, archivedTag]) {
            if (tag?.uuid) await logseq.Editor.deletePage(tag.uuid);
        }

        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("CASE_INSENSITIVE_TITLE_SEARCH.ds finds the known block", async () => {
        const result = await logseq.DB.datascriptQuery(
            CASE_INSENSITIVE_TITLE_SEARCH,
            ednString("(?i)mixed case keyword")
        );

        expectEntityWithUuid(result, titleBlock.uuid);
    }, 30_000);

    it("file graph content failure query does not find DB graph block text", async () => {
        const result = await logseq.DB.datascriptQuery(
            FILE_GRAPH_BLOCK_CONTENT_FAILS,
            ednString("(?i)mixed case keyword")
        );

        expect(hasEntityWithUuid(result, titleBlock.uuid)).toBe(false);
    }, 30_000);

    it("PAGE_BY_NAME.ds finds the known page", async () => {
        const result = await logseq.DB.datascriptQuery(
            PAGE_BY_NAME,
            ednString(pageName.toLowerCase())
        );

        expect(flatEntities(result).some((entity) => titleOf(entity) === pageName)).toBe(true);
    }, 30_000);

    it("PAGE_REFERENCE_BACKLINKS.ds finds the known page reference", async () => {
        const result = await logseq.DB.datascriptQuery(
            PAGE_REFERENCE_BACKLINKS,
            ednString(pageName.toLowerCase())
        );

        expectEntityWithUuid(result, backlinkBlock.uuid);
    }, 30_000);

    it("TAG_OR_CHILD_TAG_MATCH.ds finds direct and child tag matches", async () => {
        const result = await logseq.DB.datascriptQuery(
            TAG_OR_CHILD_TAG_MATCH,
            ednString(parentTagName)
        );

        expectEntityWithUuid(result, parentTaggedBlock.uuid);
        expectEntityWithUuid(result, childTaggedBlock.uuid);
    }, 30_000);

    it("TAG_IDENT_MATCH.ds finds blocks tagged with a known built-in tag ident", async () => {
        const result = await logseq.DB.datascriptQuery(TAG_IDENT_MATCH, ":logseq.class/Task");

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
        expectEntityWithUuid(result, archivedTaskBlock.uuid);
    }, 30_000);

    it("tag text-search failure query does not find DB graph tag refs", async () => {
        const result = await logseq.DB.datascriptQuery(
            TAG_TEXT_SEARCH_FAILS,
            ednString(parentTagName)
        );

        expect(hasEntityWithUuid(result, parentTaggedBlock.uuid)).toBe(false);
    }, 30_000);

    it("PUBLIC_PROPERTY_SCHEMAS.ds finds the known property schema", async () => {
        const result = await logseq.DB.datascriptQuery(PUBLIC_PROPERTY_SCHEMAS);

        expect(flatEntities(result).some((entity) => titleOf(entity) === checkedPropertyKey)).toBe(
            true
        );
    }, 30_000);

    it("JOURNAL_PAGES_IN_RANGE.ds finds the known journal page", async () => {
        const result = await logseq.DB.datascriptQuery(
            JOURNAL_PAGES_IN_RANGE,
            String(scheduledDay),
            String(scheduledDay)
        );

        expectEntityWithUuid(result, journalPage.uuid);
    }, 30_000);

    it("PROPERTY_NODE_LIST_ANY.ds finds the known node-list property value", async () => {
        const result = await logseq.DB.datascriptQuery(
            PROPERTY_NODE_LIST_ANY,
            nodePropertyIdent,
            `[${ednString(pageName)}]`
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
    }, 30_000);

    it("file graph properties-map failure query does not find DB graph properties", async () => {
        const result = await logseq.DB.datascriptQuery(
            BLOCK_PROPERTIES_MAP_FAILS,
            `:${numberPropertyKey}`
        );

        expect(hasEntityWithUuid(result, actionableTaskBlock.uuid)).toBe(false);
    }, 30_000);

    it("MIXED_PROPERTY_TYPES_AND_TITLE_SEARCH.ds finds the known mixed-property block", async () => {
        const result = await logseq.DB.datascriptQuery(
            MIXED_PROPERTY_TYPES_AND_TITLE_SEARCH,
            ednString("(?i)launch actionable"),
            checkedPropertyIdent,
            numberPropertyIdent,
            nodePropertyIdent,
            "80",
            ednString(pageName)
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
    }, 30_000);

    it("TASKS_BY_STATUS_OR_IMPLICIT_TODO.ds finds the known implicit Todo task", async () => {
        const result = await logseq.DB.datascriptQuery(
            TASKS_BY_STATUS_OR_IMPLICIT_TODO,
            `#{${ednString("Todo")}}`
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
    }, 30_000);

    it("TASKS_SCHEDULED_IN_RANGE.ds finds the known scheduled task", async () => {
        const result = await logseq.DB.datascriptQuery(
            TASKS_SCHEDULED_IN_RANGE,
            scheduledPropertyIdent,
            `#{${ednString("Todo")}}`,
            String(scheduledDay),
            String(scheduledDay)
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
    }, 30_000);

    it("file graph scheduled failure query does not find DB graph scheduled refs", async () => {
        const result = await logseq.DB.datascriptQuery(
            BLOCK_SCHEDULED_FAILS,
            String(scheduledDay),
            String(scheduledDay)
        );

        expect(hasEntityWithUuid(result, actionableTaskBlock.uuid)).toBe(false);
    }, 30_000);

    it("TASKS_PRIORITY_NOT_ARCHIVED.ds includes the known task and excludes archived", async () => {
        const result = await logseq.DB.datascriptQuery(
            TASKS_PRIORITY_NOT_ARCHIVED,
            priorityPropertyIdent,
            `#{${ednString(pageName)}}`,
            ednString(archivedTagName)
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
        expect(hasEntityWithUuid(result, archivedTaskBlock.uuid)).toBe(false);
    }, 30_000);

    it("or variable mismatch failure query returns an error", async () => {
        const result = await logseq.DB.datascriptQuery(OR_VARIABLE_MISMATCH_FAILS);

        expect(result).toMatchObject({
            error: expect.stringContaining("All clauses in 'or' must use same set of free vars")
        });
    }, 30_000);

    it("COMPLEX_ACTIONABLE_TASK_SEARCH.ds finds the known task and excludes archived", async () => {
        const result = await logseq.DB.datascriptQuery(
            COMPLEX_ACTIONABLE_TASK_SEARCH,
            ednString("(?i)launch"),
            `#{${ednString("Todo")}}`,
            priorityPropertyIdent,
            `#{${ednString(pageName)}}`,
            scheduledPropertyIdent,
            String(scheduledDay),
            String(scheduledDay),
            nodePropertyIdent,
            `#{${ednString(pageName)}}`,
            ednString(archivedTagName)
        );

        expectEntityWithUuid(result, actionableTaskBlock.uuid);
        expect(hasEntityWithUuid(result, archivedTaskBlock.uuid)).toBe(false);
    }, 30_000);
});
