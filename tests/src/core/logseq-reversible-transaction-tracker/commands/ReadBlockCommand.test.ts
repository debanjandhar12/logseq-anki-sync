import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {ReadBlockCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/ReadBlockCommand";
import {LogseqEditor} from "../../../../../src/logseq/LogseqEditor";

const pageName = "ReadBlockCommandTestPage_" + Date.now();
const deletedPageName = "ReadBlockCommandDeletedPageTestPage_" + Date.now();
const tagName = "ReadBlockCommandTestTag_" + Date.now();
const propertyKey = "ReadBlockCommandTestProperty_" + Date.now();
const pageBlockContent = "ReadBlockCommand page child";
const parentBlockContent = "ReadBlockCommand parent block";
const childBlockContent = "ReadBlockCommand child block";
const waitForLogseqDb = () => new Promise((resolve) => setTimeout(resolve, 300));
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;
const getChildContent = (child: BlockEntity | [string, string]) =>
    Array.isArray(child) ? undefined : child.content;

describe.skipIf(!shouldRunTests())("ReadBlockCommand", () => {
    let page: PageEntity;
    let parentBlock: BlockEntity;
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

        page = await logseq.Editor.createPage(pageName, {}, {createFirstBlock: false});
        if (!page) page = (await logseq.Editor.getPage(pageName))!;

        await logseq.Editor.appendBlockInPage(page.uuid, pageBlockContent);
        const rawParentBlock = (await logseq.Editor.appendBlockInPage(
            page.uuid,
            parentBlockContent
        ))!;
        parentBlock = (await logseq.Editor.getBlock(rawParentBlock.uuid))!;
        await logseq.Editor.insertBlock(parentBlock.uuid, childBlockContent, {sibling: false});

        deletedPage = await logseq.Editor.createPage(
            deletedPageName,
            {},
            {createFirstBlock: false}
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

    it("Can read pages with children true using the page UUID.", async () => {
        const command = new ReadBlockCommand({uuid: page.uuid, includeChildren: true});

        const result = await command.execute();

        expect(result.type).toBe("page");
        expect(result.block.uuid).toBe(page.uuid);
        expect(
            result.block.children?.some((child) => getChildContent(child) === pageBlockContent)
        ).toBe(true);
    }, 60_000);

    it("Can read blocks with children.", async () => {
        const command = new ReadBlockCommand({uuid: parentBlock.uuid, includeChildren: true});

        const result = await command.execute();

        expect(result.type).toBe("block");
        expect(result.block?.uuid).toBe(parentBlock.uuid);
        expect(
            result.block?.children?.some((child) => getChildContent(child) === childBlockContent)
        ).toBe(true);
    }, 60_000);

    it("Can read soft deleted pages without passing children.", async () => {
        const command = new ReadBlockCommand({uuid: deletedPage.uuid});

        const result = await command.execute();

        expect(result.type).toBe("page");
        expect(result.block.uuid).toBe(deletedPage.uuid);
    }, 60_000);

    it("Can read tag pages using the tag page UUID.", async () => {
        const command = new ReadBlockCommand({uuid: tagPage.uuid});

        const result = await command.execute();

        expect(result.type).toBe("tag");
        expect(result.block?.uuid).toBe(tagPage.uuid);
    }, 60_000);

    it("Can read property pages using the property page UUID.", async () => {
        const command = new ReadBlockCommand({uuid: propertyPage.uuid});

        const result = await command.execute();

        expect(result.type).toBe("property");
        expect(result.block?.uuid).toBe(propertyPage.uuid);
    }, 60_000);

    it("Does not classify invalid tag or property UUIDs as metadata pages.", async () => {
        const missingUuid = crypto.randomUUID();

        await expect(LogseqEditor.isTagBlock(parentBlock.uuid)).resolves.toBe(false);
        await expect(LogseqEditor.isPropertyBlock(page.uuid)).resolves.toBe(false);
        await expect(LogseqEditor.isTagBlock(missingUuid)).resolves.toBe(false);
        await expect(LogseqEditor.isPropertyBlock(missingUuid)).resolves.toBe(false);
        await expect(LogseqEditor.getProperty(missingUuid)).resolves.toBeNull();
    }, 60_000);

    it("Revert is a no-op.", async () => {
        const command = new ReadBlockCommand({uuid: page.uuid});

        await expect(command.revert()).resolves.toBeUndefined();
    }, 60_000);
});
