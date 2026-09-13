import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {DeletePropertyFromBlockCommand} from "src/core/logseq-reversible-transaction-tracker";
import {LogseqBlockPropertyHelper} from "src/logseq/LogseqBlockPropertyHelper";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const pageName = "test-delete-property-from-block-command";
const propertyKey = "test-delete-property-from-block-command-property";
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
        await deletePagePermanently(pageName);
        await deletePagePermanently(propertyKey);

        page =
            (await logseq.Editor.createPage(
                pageName,
                {},
                {redirect: false, createFirstBlock: false}
            )) ?? (await logseq.Editor.getPage(pageName))!;
        block = (await logseq.Editor.appendBlockInPage(page.uuid, "Delete block"))!;
        await logseq.Editor.upsertProperty(propertyKey, {type: "default", cardinality: "one"});
        propertyPage = (await logseq.Editor.getProperty(propertyKey))!;
    }, 120_000);

    afterAll(async () => {
        await deletePagePermanently(pageName);
        await deletePagePermanently(propertyKey);
    }, 60_000);

    it("execute and revert works with property uuid", async () => {
        await logseq.Editor.upsertBlockProperty(block.uuid, propertyKey, "delete me", {
            reset: true
        });

        const command = new DeletePropertyFromBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent: propertyPage.uuid
        });

        await command.execute();
        expect(await logseq.Editor.getBlockProperty(block.uuid, propertyKey)).toBeNull();

        await command.revert();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("delete me");
    }, 60_000);

    it("execute and revert works with property indent", async () => {
        await logseq.Editor.upsertBlockProperty(block.uuid, propertyKey, "delete by indent", {
            reset: true
        });

        const command = new DeletePropertyFromBlockCommand({
            blockUuid: block.uuid,
            propertyUuidOrIndent: propertyKey
        });

        await command.execute();
        expect(await logseq.Editor.getBlockProperty(block.uuid, propertyKey)).toBeNull();

        await command.revert();

        await expect(
            LogseqBlockPropertyHelper.getBlockProperty(block.uuid, propertyKey)
        ).resolves.toBe("delete by indent");
        await logseq.Editor.removeBlockProperty(block.uuid, propertyKey);
    }, 60_000);

    it("records the page when deleting a property from its page block", async () => {
        await logseq.Editor.upsertBlockProperty(page.uuid, propertyKey, "delete from page", {
            reset: true
        });

        const command = new DeletePropertyFromBlockCommand({
            blockUuid: page.uuid,
            propertyUuidOrIndent: propertyKey
        });

        await command.execute();

        expect(command.getChangedPages()).toEqual([page.uuid]);
        expect(await logseq.Editor.getBlockProperty(page.uuid, propertyKey)).toBeNull();

        await command.revert();
        await logseq.Editor.removeBlockProperty(page.uuid, propertyKey);
    }, 60_000);
});
