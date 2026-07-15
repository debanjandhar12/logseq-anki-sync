import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {
    createLogseqAttachmentFromUuid,
    LOGSEQ_ATTACHMENT_TYPES
} from "../../../../src/chat-app/runtime/LogseqAttachmentAdapter";

const pageName = "LogseqAttachmentAdapterTestPage_" + Date.now();
const deletedPageName = "LogseqAttachmentAdapterDeletedPage_" + Date.now();
const tagName = "LogseqAttachmentAdapterTestTag_" + Date.now();
const propertyKey = "LogseqAttachmentAdapterTestProperty_" + Date.now();
const blockContent = "LogseqAttachmentAdapter block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("LogseqAttachmentAdapter", () => {
    let page: PageEntity;
    let block: BlockEntity;
    let deletedPage: PageEntity;
    let tagPage: PageEntity;
    let propertyPage: BlockEntity;

    beforeAll(async () => {
        for (const testPageName of [pageName, deletedPageName]) {
            const existingPage = await logseq.Editor.getPage(testPageName);
            if (existingPage) {
                await logseq.Editor.deletePage(testPageName);
                await waitForLogseqDb();
            }
        }

        const existingTag = await logseq.Editor.getTag(tagName);
        if (existingTag) {
            await logseq.Editor.deletePage(existingTag.uuid);
            await waitForLogseqDb();
        }

        const existingProperty = await logseq.Editor.getProperty(propertyKey);
        if (existingProperty) {
            await logseq.Editor.removeProperty(propertyKey);
            await waitForLogseqDb();
        }

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        const createdBlock = (await logseq.Editor.appendBlockInPage(page.uuid, blockContent))!;
        block = (await logseq.Editor.getBlock(createdBlock.uuid))!;

        deletedPage = await logseq.Editor.createPage(
            deletedPageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!deletedPage) deletedPage = (await logseq.Editor.getPage(deletedPageName))!;
        await logseq.Editor.deletePage(deletedPage.uuid);

        tagPage =
            (await logseq.Editor.createTag(tagName)) ?? (await logseq.Editor.getTag(tagName))!;

        await logseq.Editor.upsertProperty(propertyKey, {type: "default"});
        propertyPage = (await logseq.Editor.getProperty(propertyKey))!;

        await waitForLogseqDb();
    }, 60_000);

    afterAll(async () => {
        await logseq.Editor.removeProperty(propertyKey);
        await logseq.Editor.deletePage(tagPage?.uuid ?? tagName);
        await logseq.Editor.deletePage(pageName);
        await logseq.Editor.deletePage(deletedPageName);
        await waitForLogseqDb();
    }, 60_000);

    it("creates page attachments using the page UUID", async () => {
        const attachment = await createLogseqAttachmentFromUuid(page.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.page);
        expect(attachment.id).toBe(page.uuid);
        expect(attachment.content).toEqual([{type: "text", text: `Page UUID: ${page.uuid}`}]);
    }, 60_000);

    it("creates simple block attachments using the block UUID", async () => {
        const attachment = await createLogseqAttachmentFromUuid(block.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.block);
        expect(attachment.id).toBe(block.uuid);
        expect(attachment.content).toEqual([{type: "text", text: `Block UUID: ${block.uuid}`}]);
    }, 60_000);

    it("creates attachments for soft-deleted pages", async () => {
        const attachment = await createLogseqAttachmentFromUuid(deletedPage.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.page);
        expect(attachment.content).toEqual([
            {type: "text", text: `Page UUID: ${deletedPage.uuid}`}
        ]);
    }, 60_000);

    it("creates tag page attachments using the tag page UUID", async () => {
        const attachment = await createLogseqAttachmentFromUuid(tagPage.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.tagPage);
        expect(attachment.id).toBe(tagPage.uuid);
        expect(attachment.content).toEqual([
            {type: "text", text: `Tag Page UUID: ${tagPage.uuid}`}
        ]);
    }, 60_000);

    it("auto-detects property pages using the property page UUID", async () => {
        const attachment = await createLogseqAttachmentFromUuid(propertyPage.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.propertyPage);
        expect(attachment.id).toBe(propertyPage.uuid);
        expect(attachment.content).toEqual([
            {type: "text", text: `Property Page UUID: ${propertyPage.uuid}`}
        ]);
    }, 60_000);

    it("rejects UUIDs that do not identify a Logseq entity", async () => {
        const missingUuid = crypto.randomUUID();

        await expect(createLogseqAttachmentFromUuid(missingUuid)).rejects.toThrow(
            `Logseq entity not found: ${missingUuid}`
        );
    }, 60_000);
});
