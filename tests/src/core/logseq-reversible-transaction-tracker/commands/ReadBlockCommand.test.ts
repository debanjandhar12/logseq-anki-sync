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

describe("ReadBlockCommand args", () => {
    it("Requires exactly one of uuid or propertyIndent.", () => {
        expect(() => new ReadBlockCommand({})).toThrow();
        expect(() => new ReadBlockCommand({uuid: pageName, propertyIndent: propertyKey})).toThrow();
        expect(() => new ReadBlockCommand({uuid: pageName})).not.toThrow();
        expect(() => new ReadBlockCommand({propertyIndent: propertyKey})).not.toThrow();
    });
});

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

        page = await logseq.Editor.createPage(
            pageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
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

    it("Can read property pages using the property indent.", async () => {
        const command = new ReadBlockCommand({propertyIndent: propertyKey});

        const result = await command.execute();

        expect(result.type).toBe("property");
        expect(result.block?.uuid).toBe(propertyPage.uuid);
        expect(result.block).not.toHaveProperty("refs");
    }, 60_000);

    it("Can auto-detect property pages using the property page UUID.", async () => {
        const command = new ReadBlockCommand({uuid: propertyPage.uuid});

        const result = await command.execute();

        await expect(LogseqEditor.isPropertyBlock(propertyPage)).resolves.toBe(true);
        expect(result.type).toBe("property");
        expect(result.block?.uuid).toBe(propertyPage.uuid);
        expect(result.block).not.toHaveProperty("refs");
    }, 60_000);

    it("Does not classify invalid tag UUIDs and invalid property indents as metadata pages.", async () => {
        const missingUuid = crypto.randomUUID();
        const missingPropertyIndent = `missing-property-${Date.now()}`;

        const tagResult = await new ReadBlockCommand({uuid: missingUuid}).execute();
        const propertyResult = await new ReadBlockCommand({
            propertyIndent: missingPropertyIndent
        }).execute();

        await expect(LogseqEditor.isPropertyBlock(page)).resolves.toBe(false);
        expect(tagResult).toEqual({type: "block", block: null});
        expect(propertyResult).toEqual({type: "property", block: null});
    }, 60_000);

    it("Revert is a no-op.", async () => {
        const command = new ReadBlockCommand({uuid: page.uuid});

        await command.execute();
        await expect(command.revert()).resolves.toBeUndefined();
        expect(command.getCommandState()).toEqual({status: "new"});
    }, 60_000);
});
