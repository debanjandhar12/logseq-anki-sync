import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import FIND_ORIGINAL_PAGE_FROM_ALIAS from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import PAGE_MEMBERSHIP from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PAGE_MEMBERSHIP.ds?raw";
import PROPERTY_REVERSE_LOOKUP from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/PROPERTY_REVERSE_LOOKUP.ds?raw";
import RECURSIVE_CLASS_INHERITANCE from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/RECURSIVE_CLASS_INHERITANCE.ds?raw";
import STATUS_HISTORY from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/STATUS_HISTORY.ds?raw";
import {DataScriptQueryCommand} from "src/core/logseq-reversible-transaction-tracker/commands/DataScriptQueryCommand";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

const testId = Date.now();
const pageName = `SkillAliasOriginal_${testId}`;
const aliasName = `SkillAliasName_${testId}`;
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 700));
const ednString = (value: string) => JSON.stringify(value);

async function runQuery(datalogString: string, ...inputs: string[]): Promise<unknown> {
    return new DataScriptQueryCommand({datalogString, inputs}).execute();
}

function entityUuids(result: unknown): string[] {
    expect(Array.isArray(result)).toBe(true);
    return (result as Array<[Record<string, unknown>]>).map(([entity]) =>
        String(entity[":block/uuid"] ?? entity["block/uuid"] ?? entity.uuid)
    );
}

function queryForAlias(title: string): string {
    const query = FIND_ORIGINAL_PAGE_FROM_ALIAS.match(/\{:query\s*([\s\S]+)\}\s*$/)?.[1];
    if (!query) throw new Error("Alias example must contain an advanced-query wrapper");
    return query.replace('"another name"', JSON.stringify(title));
}

describe.skipIf(!shouldRunTests())("Datascript example queries", () => {
    const propertyKeys: string[] = [];
    const tags: PageEntity[] = [];
    const blocks: BlockEntity[] = [];
    const rootName = `SkillExampleRoot_${testId}`;
    const parts = RECURSIVE_CLASS_INHERITANCE.match(
        /\{:query\s*(\[[\s\S]+\])\s*:rules\s*(\[[\s\S]+\])\s*\}\s*$/
    );
    if (!parts) throw new Error("Inheritance example must contain query and rules vectors");
    const [, inheritanceQuery, inheritanceRules] = parts;
    let page: PageEntity;
    let alias: PageEntity;
    let top: BlockEntity;
    let nested: BlockEntity;
    let backlink: BlockEntity;
    let oneMatch: BlockEntity;
    let manyMatch: BlockEntity;
    let wrongTarget: BlockEntity;
    let wrongProperty: BlockEntity;
    let oneIdent: string;
    let manyIdent: string;

    async function createNodeProperty(suffix: string, cardinality: "one" | "many") {
        const key = `skill_example_${suffix}_${testId}`;
        propertyKeys.push(key);
        await logseq.Editor.upsertProperty(key, {type: "node", cardinality});
        const property = (await logseq.Editor.getProperty(key)) as
            | (BlockEntity & {ident?: string})
            | null;
        if (!property?.ident) throw new Error(`Missing ident for ${key}`);
        return {key, ident: property.ident};
    }

    beforeAll(async () => {
        page = (await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        ))!;
        alias = (await logseq.Editor.createPage(
            aliasName,
            {},
            {redirect: false, createFirstBlock: false}
        ))!;
        await logseq.Editor.upsertBlockProperty(page.uuid, ":block/alias", [alias.id], {
            reset: true
        });
        top = (await logseq.Editor.appendBlockInPage(page.uuid, "Top-level member"))!;
        nested = (await logseq.Editor.insertBlock(top.uuid, "Nested member", {sibling: false}))!;
        backlink = (await logseq.Editor.appendBlockInPage(
            alias.uuid,
            `Backlink only [[${pageName}]]`
        ))!;
        oneMatch = (await logseq.Editor.appendBlockInPage(alias.uuid, "One-valued relationship"))!;
        manyMatch = (await logseq.Editor.appendBlockInPage(
            alias.uuid,
            "Many-valued relationship"
        ))!;
        wrongTarget = (await logseq.Editor.appendBlockInPage(alias.uuid, "Wrong target"))!;
        wrongProperty = (await logseq.Editor.appendBlockInPage(alias.uuid, "Wrong property"))!;
        const one = await createNodeProperty("one", "one");
        const many = await createNodeProperty("many", "many");
        const decoy = await createNodeProperty("decoy", "one");
        oneIdent = one.ident;
        manyIdent = many.ident;
        await logseq.Editor.upsertBlockProperty(oneMatch.uuid, one.key, page.id, {reset: true});
        await logseq.Editor.upsertBlockProperty(wrongTarget.uuid, one.key, alias.id, {reset: true});
        await logseq.Editor.upsertBlockProperty(wrongProperty.uuid, decoy.key, page.id, {
            reset: true
        });
        await logseq.Editor.upsertBlockProperty(manyMatch.uuid, many.key, [page.id, alias.id], {
            reset: true
        });
        for (const name of [
            rootName,
            `SkillExampleChild_${testId}`,
            `SkillExampleGrandchild_${testId}`,
            `SkillExampleGreatGrandchild_${testId}`,
            `SkillExampleUnrelated_${testId}`
        ]) {
            const tag = (await logseq.Editor.createTag(name))!;
            tags.push(tag);
            const block = (await logseq.Editor.appendBlockInPage(alias.uuid, `Tagged ${name}`))!;
            blocks.push(block);
            await logseq.Editor.addBlockTag(block.uuid, tag.uuid);
        }
        for (let index = 1; index < 4; index++)
            await logseq.Editor.addTagExtends(tags[index].uuid, tags[index - 1].uuid);
        // Keep the great-grandchild-only block to prove three-level traversal.
        // A separate block tests duplicate direct and transitive matches.
        const duplicateMatch = (await logseq.Editor.appendBlockInPage(
            alias.uuid,
            "Direct and inherited match"
        ))!;
        blocks.push(duplicateMatch);
        await logseq.Editor.addBlockTag(duplicateMatch.uuid, tags[0].uuid);
        await logseq.Editor.addBlockTag(duplicateMatch.uuid, tags[3].uuid);
        // Reuse relationship blocks as history fixtures without changing their refs.
        const taskTag =
            (await logseq.Editor.getTag("Task")) ?? (await logseq.Editor.createTag("Task"))!;
        for (const block of [oneMatch, wrongTarget])
            await logseq.Editor.addBlockTag(block.uuid, taskTag.uuid);
        for (const status of ["Doing", "Done"]) {
            await logseq.Editor.upsertBlockProperty(
                oneMatch.uuid,
                ":logseq.property/status",
                status,
                {
                    reset: true
                }
            );
            await waitForLogseqDb();
        }
        await logseq.Editor.upsertBlockProperty(
            wrongTarget.uuid,
            ":logseq.property/status",
            "Canceled",
            {reset: true}
        );
        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        if (page?.uuid) await logseq.Editor.deletePage(page.uuid);
        if (alias?.uuid) await logseq.Editor.deletePage(alias.uuid);
        for (const tag of tags.reverse()) await logseq.Editor.deletePage(tag.uuid);
        for (const key of propertyKeys) {
            if (await logseq.Editor.getProperty(key)) await logseq.Editor.removeProperty(key);
        }
        await waitForLogseqDb();
    }, 60_000);

    it("FIND_ORIGINAL_PAGE_FROM_ALIAS.ds finds the original page rather than the alias", async () => {
        const result = await runQuery(queryForAlias(aliasName));
        expect(entityUuids(result)).toContain(page.uuid);
        expect(entityUuids(result)).not.toContain(alias.uuid);
    }, 30_000);

    it("PAGE_MEMBERSHIP.ds includes nested members and excludes external backlinks", async () => {
        const result = await runQuery(PAGE_MEMBERSHIP, ednString(pageName.toLowerCase()));
        expect(entityUuids(result).sort()).toEqual([top.uuid, nested.uuid].sort());
        expect(entityUuids(result)).not.toContain(backlink.uuid);
        expect(await runQuery(PAGE_MEMBERSHIP, ednString(`missing_${testId}`))).toEqual([]);
    }, 30_000);

    it("PROPERTY_REVERSE_LOOKUP.ds matches only the requested property and target", async () => {
        const result = await runQuery(
            PROPERTY_REVERSE_LOOKUP,
            oneIdent,
            ednString(pageName.toLowerCase())
        );
        expect(entityUuids(result)).toEqual([oneMatch.uuid]);
        expect(entityUuids(result)).not.toContain(wrongTarget.uuid);
        expect(entityUuids(result)).not.toContain(wrongProperty.uuid);
        expect(entityUuids(result)).not.toContain(backlink.uuid);
        const manyResult = await runQuery(
            PROPERTY_REVERSE_LOOKUP,
            manyIdent,
            ednString(pageName.toLowerCase())
        );
        expect(entityUuids(manyResult)).toEqual([manyMatch.uuid]);
        expect(
            await runQuery(PROPERTY_REVERSE_LOOKUP, oneIdent, ednString(`missing_${testId}`))
        ).toEqual([]);
        expect(
            await runQuery(
                PROPERTY_REVERSE_LOOKUP,
                `:user.property/missing-${testId}`,
                ednString(pageName.toLowerCase())
            )
        ).toEqual([]);
    }, 30_000);

    it("RECURSIVE_CLASS_INHERITANCE.ds finds direct and deep subclasses without duplicates", async () => {
        const result = await runQuery(inheritanceQuery, ednString(rootName), inheritanceRules);
        const uuids = entityUuids(result);
        expect(uuids.sort()).toEqual(
            [...blocks.slice(0, 4), blocks[5]].map((block) => block.uuid).sort()
        );
        expect(new Set(uuids).size).toBe(uuids.length);
        expect(uuids).not.toContain(blocks[4].uuid);
    }, 30_000);

    it("returns no rows for an unknown class", async () => {
        expect(
            await runQuery(inheritanceQuery, ednString(`missing_${testId}`), inheritanceRules)
        ).toEqual([]);
    }, 30_000);

    it("STATUS_HISTORY.ds returns editor-generated status events for only the requested block", async () => {
        const result = await runQuery(
            STATUS_HISTORY,
            `#uuid ${ednString(oneMatch.uuid)}`,
            ":logseq.property/status"
        );
        expect(Array.isArray(result)).toBe(true);
        const rows = result as Array<[number, string, number]>;
        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(rows.map(([, title]) => title)).toEqual(expect.arrayContaining(["Doing", "Done"]));
        expect(rows.map(([, title]) => title)).not.toContain("Canceled");
        for (const [historyId, , timestamp] of rows) {
            expect(Number.isFinite(historyId)).toBe(true);
            expect(Number.isFinite(timestamp)).toBe(true);
        }
        const ordered = [...rows].sort((left, right) => left[2] - right[2]);
        expect(ordered.findIndex(([, title]) => title === "Doing")).toBeLessThan(
            ordered.findIndex(([, title]) => title === "Done")
        );
        expect(
            await runQuery(
                STATUS_HISTORY,
                '#uuid "00000000-0000-0000-0000-000000000000"',
                ":logseq.property/status"
            )
        ).toEqual([]);
    }, 30_000);
});
