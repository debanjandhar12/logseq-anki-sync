import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {DataScriptQueryCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/DataScriptQueryCommand";

const pageName = "DataScriptQueryCommandTestPage_" + Date.now();
const blockContent = "DataScriptQueryCommand test block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("DataScriptQueryCommand", () => {
    let page: PageEntity;

    beforeAll(async () => {
        const existingPage = await logseq.Editor.getPage(pageName);
        if (existingPage) {
            await logseq.Editor.deletePage(pageName);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;
        await logseq.Editor.appendBlockInPage(page.uuid, blockContent);
        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("Runs a DataScript query without inputs.", async () => {
        const command = new DataScriptQueryCommand({
            datalogString: `
                [:find ?title
                 :where
                 [?p :block/name "${pageName.toLowerCase()}"]
                 [?p :block/title ?title]]
            `
        });

        const result = await command.execute();

        expect(result.flat()).toContain(pageName);
    }, 60_000);

    it("Runs a DataScript query with inputs.", async () => {
        const command = new DataScriptQueryCommand({
            datalogString: `
                [:find ?title
                 :in $ ?page-name
                 :where
                 [?p :block/name ?page-name]
                 [?b :block/page ?p]
                 [?b :block/title ?title]
                 [(= ?title "${blockContent}")]]
            `,
            inputs: [`"${pageName.toLowerCase()}"`]
        });

        const result = await command.execute();

        expect(result.flat()).toContain(blockContent);
    }, 60_000);

    it("Revert is a no-op.", async () => {
        const command = new DataScriptQueryCommand({
            datalogString: "[:find ?b :where [?b :block/name]]"
        });

        await command.execute();
        await expect(command.revert()).resolves.toBeUndefined();
        expect(command.getCommandState()).toEqual({status: "new"});
    });
});
