// If any of these cases fail, update the corresponding Logseq query skill file because the documented query pattern is no longer valid.
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, test} from "vitest";

const pageName = "Skill Query Regression DB";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));

const runDatalog = async (query: string, ...inputs: string[]) => {
    const result = await logseq.DB.datascriptQuery(query, ...inputs);
    return Array.isArray(result) ? result : [];
};

const firstPulledEntity = (rows: unknown[][]): Record<string, unknown> =>
    rows[0]?.[0] as Record<string, unknown>;

describe("Logseq DB query skill examples", () => {
    let page: PageEntity;

    const shouldRunDbQueryTests = () =>
        globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

    beforeAll(async () => {
        if (!shouldRunDbQueryTests()) return;

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: false});

        await logseq.Editor.appendBlockInPage(page.uuid, "Skill query unique title keyword");
        await logseq.Editor.appendBlockInPage(page.uuid, "Skill query second title");
        await logseq.Editor.appendBlockInPage(page.uuid, "Skill query property block");

        await waitForLogseqDb();
    }, 30_000);

    afterAll(async () => {
        if (!shouldRunDbQueryTests()) return;

        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 30_000);

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATASCRIPT_QUERY: queries blocks by title text",
        async () => {
            const rows = await runDatalog(`
                [:find (pull ?b [:block/uuid :block/title])
                 :where
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "unique title keyword")]]
            `);

            expect(firstPulledEntity(rows).title).toBe("Skill query unique title keyword");
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATASCRIPT_QUERY: queries blocks by lowercase page name input",
        async () => {
            const rows = await runDatalog(
                `
                [:find ?title
                 :in $ ?page-name
                 :where
                 [?p :block/name ?page-name]
                 [?b :block/page ?p]
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "Skill query")]]
            `,
                `"${pageName.toLowerCase()}"`
            );

            expect(rows.flat()).toContain("Skill query property block");
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATASCRIPT_QUERY: queries pages by name",
        async () => {
            const pages = await runDatalog(`
                [:find ?title
                 :where
                 [?p :block/name "${pageName.toLowerCase()}"]
                 [?p :block/title ?title]]
            `);
            expect(pages.flat()).toContain(pageName);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATASCRIPT_QUERY: queries with not clauses",
        async () => {
            const notRows = await runDatalog(`
                [:find ?title
                 :where
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "Skill query")]
                 (not [?b :block/title "Skill query property block"])]
            `);
            expect(notRows.flat()).toContain("Skill query unique title keyword");
            expect(notRows.flat()).not.toContain("Skill query property block");
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATALOG_QUERY: supports aggregation queries",
        async () => {
            const blockCount = await runDatalog(`
                [:find (count ?b)
                 :where
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "Skill query")]]
            `);
            const grouped = await runDatalog(`
                [:find ?page-name (count ?b)
                 :where
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "Skill query")]
                 [?b :block/page ?p]
                 [?p :block/name ?page-name]]
            `);
            const titleLengthRange = await runDatalog(`
                [:find (min ?length) (max ?length)
                 :where
                 [?b :block/title ?title]
                 [(clojure.string/includes? ?title "Skill query")]
                 [(count ?title) ?length]]
            `);

            expect(blockCount[0][0]).toBeGreaterThanOrEqual(3);
            expect(grouped[0][0]).toBe(pageName.toLowerCase());
            expect(grouped[0][1]).toBeGreaterThanOrEqual(3);
            expect(titleLengthRange[0][0]).toBeLessThanOrEqual(titleLengthRange[0][1]);
        }
    );

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "SKILL_LOGSEQ_DATASCRIPT_QUERY_PITFALLS: confirms DB replacements for removed file graph attributes",
        async () => {
            const blockTitleRows = await runDatalog(`
                [:find ?title
                 :where
                 [?b :block/title ?title]
                 [(= ?title "Skill query unique title keyword")]]
            `);
            const pageTitleRows = await runDatalog(`
                [:find ?title
                 :where
                 [?p :block/name "${pageName.toLowerCase()}"]
                 [?p :block/title ?title]]
            `);
            expect(blockTitleRows.flat()).toContain("Skill query unique title keyword");
            expect(pageTitleRows.flat()).toContain(pageName);
        }
    );
});
