import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {DeletePropertyFromBlockCommand} from "src/core/logseq-reversible-transaction-tracker";
import {LogseqBlockPropertyHelper} from "src/logseq/LogseqBlockPropertyHelper";

const testId = Date.now();
const pageName = `DeletePropertyFromBlockPage_${testId}`;
const propertyKey = `DeletePropertyFromBlock_${testId}`;
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 350));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe("DeletePropertyFromBlockCommand args", () => {
    it("requires a property UUID or indent", () => {
        expect(
            () =>
                new DeletePropertyFromBlockCommand({
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f39"
                } as never)
        ).toThrow();
        expect(
            () =>
                new DeletePropertyFromBlockCommand({
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f39",
                    propertyUuidOrIndent: "deck"
                })
        ).not.toThrow();
    });
});

describe.skipIf(!shouldRunTests())("DeletePropertyFromBlockCommand", () => {
    let page: PageEntity;
    let block: BlockEntity;
    let propertyPage: BlockEntity;

    beforeAll(async () => {
        if (await logseq.Editor.getProperty(propertyKey)) {
            await logseq.Editor.removeProperty(propertyKey);
            await waitForLogseqDb();
        }

        page =
            (await logseq.Editor.createPage(pageName, {}, {createFirstBlock: false})) ??
            (await logseq.Editor.getPage(pageName))!;
        await waitForLogseqDb();
        block = (await logseq.Editor.appendBlockInPage(page.uuid, `Delete block ${testId}`))!;
        await waitForLogseqDb();
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        propertyPage = (await logseq.Editor.getProperty(propertyKey))!;
        await waitForLogseqDb();
    }, 120_000);

    afterAll(async () => {
        if (await logseq.Editor.getProperty(propertyKey))
            await logseq.Editor.removeProperty(propertyKey);
        await logseq.Editor.deletePage(pageName);
        await waitForLogseqDb();
    }, 60_000);

    it("execute and revert works with property uuid", async () => {
        await logseq.Editor.upsertBlockProperty(block.uuid, propertyKey, "delete me", {
            reset: true
        });
        await waitForLogseqDb();

        const command = new DeletePropertyFromBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent: propertyPage.uuid
        });

        await command.execute();
        await waitForLogseqDb();
        expect(await logseq.Editor.getBlockProperty(block.uuid, propertyKey)).toBeNull();

        await command.revert();
        await waitForLogseqDb();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("delete me");
    }, 60_000);
});
