import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import FIND_ORIGINAL_PAGE_FROM_ALIAS from "src/chat-app/prompts/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds?raw";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

const testId = Date.now();
const pageName = `SkillAliasOriginal_${testId}`;
const aliasName = `SkillAliasName_${testId}`;
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

function queryForAlias(title: string): string {
    const query = FIND_ORIGINAL_PAGE_FROM_ALIAS.match(/\{:query\s*([\s\S]+)\}\s*$/)?.[1];
    if (!query) throw new Error("Alias example must contain an advanced-query wrapper");
    return query.replace('"another name"', JSON.stringify(title));
}

describe.skipIf(!shouldRunTests())("Datascript example queries", () => {
    let page: PageEntity;
    let alias: PageEntity;

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
        await new Promise((resolve) => setTimeout(resolve, 700));
    }, 30_000);

    afterAll(async () => {
        if (page?.uuid) await logseq.Editor.deletePage(page.uuid);
        if (alias?.uuid) await logseq.Editor.deletePage(alias.uuid);
    }, 30_000);

    it("FIND_ORIGINAL_PAGE_FROM_ALIAS.ds finds the original page rather than the alias", async () => {
        const result = await logseq.DB.datascriptQuery(queryForAlias(aliasName));
        const entities = (result as Array<[Record<string, unknown>]>).map(([entity]) => entity);
        const uuids = entities.map(
            (entity) => entity[":block/uuid"] ?? entity["block/uuid"] ?? entity.uuid
        );
        expect(uuids).toContain(page.uuid);
        expect(uuids).not.toContain(alias.uuid);
    }, 30_000);
});
