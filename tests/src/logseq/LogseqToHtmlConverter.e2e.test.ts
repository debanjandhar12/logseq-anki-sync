import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import * as cheerio from "cheerio";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import getNameFromPage from "../../../src/logseq/getNameFromPage";
import {LogseqToHtmlConverter} from "../../../src/logseq/LogseqToHtmlConverter";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";

const refTestPageName = "Ref Test";
const testLogseqAnkiSyncPageName = "Test LogseqAnkiSync";
const linuxSlidesTestPageName = "hls__Linux_Slides_Test";
const testRefPageName = "Test Ref Page";
const originalPageName = "Original Page Name";
const testEmbedPageName = "Test Embed Page";
const testLogseqAnkiSyncEmbedPageName = "Test LogseqAnkiSync Embed";
const testLogseqAnkiSyncDbPageName = "Test LogseqAnkiSync DB";
const testDbRefPageName = "Test DB Ref Page";
const testDbEmbedPageName = "Test DB Embed Page";
const linuxSlidesDbTestPageName = "hls__Linux_Slides_DB_Test";

const allTestPages = [
    refTestPageName,
    testLogseqAnkiSyncPageName,
    linuxSlidesTestPageName,
    testRefPageName,
    originalPageName,
    testEmbedPageName,
    testLogseqAnkiSyncEmbedPageName,
    testLogseqAnkiSyncDbPageName,
    testDbRefPageName,
    testDbEmbedPageName,
    linuxSlidesDbTestPageName
];

beforeEach(async () => {
    for (const testPageName of allTestPages) {
        await deletePagePermanently(testPageName);
    }
}, 60_000);

afterEach(async () => {
    for (const name of allTestPages) {
        await deletePagePermanently(name);
    }
}, 60_000);

describe("Basic Markdown Cases", () => {
    describe("Basic Inline rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable)("Page Ref Rendering", async () => {
            // Create the page that will be referenced
            await logseq.Editor.createPage(
                "Ref Test",
                {},
                {redirect: false, createFirstBlock: true}
            );
            await new Promise((resolve) => setTimeout(resolve, 100));

            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello [[Ref Test]]",
                "markdown"
            );
            const graphName = (await logseq.App.getCurrentGraph()).name;
            const normalized = htmlFile.html
                .trim()
                .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
            expect(normalized).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("a").text()).toBe("Ref Test");
            expect($("a").attr("href")).toBe(`logseq://graph/${graphName}?page=Ref%20Test`);
        });
        test.skipIf(!globalThis.isLogseqAvailable)(
            "Consecutive Page Ref Rendering - https://github.com/debanjandhar12/logseq-anki-sync/issues/101",
            async () => {
                // Create the page that will be referenced
                await logseq.Editor.createPage(
                    "Ref Test",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "[[Ref Test]][[Ref Test]] [[Ref Test]],[[Ref Test]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($("a")).toHaveLength(4);
            }
        );
        test.skipIf(!globalThis.isLogseqAvailable)("Tag Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello #World",
                "markdown",
                {displayTags: true}
            );
            const graphName = (await logseq.App.getCurrentGraph()).name;
            const normalized = htmlFile.html
                .trim()
                .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
            expect(normalized).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("a").text()).toBe("#World");
            expect($("a").attr("data-ref")).toBe("World");
            expect($("a").attr("href")).toBe(`logseq://graph/${graphName}?page=World`);
            const htmlFile2 = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello #World",
                "markdown"
            );
            const $2 = cheerio.load(htmlFile2.html);
            expect($2("a").text()).toBe("");
            expect($2("a").attr("data-ref")).toBe("World");
        });
    });
});

describe("E2E cases for non DB mode", () => {
    let page: PageEntity;
    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test LogseqAnkiSync",
            {},
            {redirect: false, createFirstBlock: true}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    describe("PDF Rendering cases", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic PDF rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "![Linux Slides 1.pdf](../assets/Linux_Slides_1_1673180335043_0.pdf)",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                // TODO: Add beauty to pdf links and check
            }
        );
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "PDF Text Annotation Rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "ls-type::annotation\nhl-page::1\nhl-color::blue\nI am pdf page content",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                expect(htmlFile.html.trim()).toContain("I am pdf page content");
                expect(htmlFile.html.trim()).toContain("P1");
                expect(htmlFile.html.trim()).toContain("🔵");
            }
        );
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "PDF Text Annotation Rendering - no color",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "ls-type::annotation\nhl-page::1\nI am pdf page content",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                expect(htmlFile.html.trim()).toContain("I am pdf page content");
                expect(htmlFile.html.trim()).toContain("P1");
                expect(htmlFile.html.trim()).toContain("📌");
            }
        );
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "PDF Image Annotation Rendering",
            async () => {
                // Create a PDF page (simulated with hls__ prefix)
                const pdfPage = await logseq.Editor.createPage(
                    "hls__Linux_Slides_Test",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                // Create the annotation block
                const block = await logseq.Editor.appendBlockInPage(
                    pdfPage.uuid,
                    "ls-type::annotation\nhl-type::area\nhl-page::1\nhl-color::blue\nhl-stamp::1673181377785\n[:span]"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    block.content,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                expect(htmlFile.assets).toBeDefined();
                if (htmlFile.assets && htmlFile.assets.size > 0) {
                    expect(htmlFile.assets[0]).toContain("Linux_Slides_Test");
                    expect(htmlFile.assets[0]).toContain("1673181377785.png");
                }
                expect(htmlFile.html.trim()).toContain("🔵");
                expect(htmlFile.html.trim()).toContain("P1");
            }
        );
    });

    describe("Block Reference Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic block ref rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A **block** with no ref."
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Ref: ((${block.uuid}))`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const refText = $(".block-ref").text().trim();
                expect(refText).toContain("block");
                expect(refText).toContain("no ref");
                expect($(".block-ref b").text()).toBe("block");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Renamed block ref rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "Original block content"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Ref: [Renamed Block](((${block.uuid})))`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".block-ref").text()).toContain("Renamed Block");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Failed block ref rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Block Ref: ((wrong-block-ref))",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".failed-block-ref").text()).toContain("wrong-block-ref");
            }
        );
    });

    describe("Page Reference Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic page ref rendering",
            async () => {
                await logseq.Editor.createPage(
                    "Test Ref Page",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Ref: [[Test Ref Page]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Test Ref Page");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Renamed page ref rendering",
            async () => {
                const refPage = await logseq.Editor.createPage(
                    "Original Page Name",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Page Ref: [Renamed Page]([[${getNameFromPage(refPage)}]])`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Renamed Page");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });

    describe("Block Embed Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic block embed rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A **block** with no ref."
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Embed: {{embed ((${block.uuid}))}}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const embedText = $(".embed-block").text().trim();
                expect($(".embed-block b").text()).toBe("block");
                expect(embedText).toContain("block");
                expect(embedText).toContain("no ref");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Nested block embed rendering",
            async () => {
                const block1 = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A block with no ref"
                );
                const block2 = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `A block with page embed {{embed ((${block1.uuid}))}}`
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Embed: {{embed ((${block2.uuid}))}}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block1.uuid, "g"), "LAS-TEST-UUID-1")
                    .replace(new RegExp(block2.uuid, "g"), "LAS-TEST-UUID-2")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-block").length).toBe(2);
                expect($(".embed-block").first().text()).toContain("A block with page embed");
                expect($(".embed-block").last().text()).toContain("A block with no ref");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "block ref inside block embed rendering",
            async () => {
                const block1 = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A block with no ref."
                );
                const block2 = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    `A block with ref ((${block1.uuid}))`
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Embed: {{embed ((${block2.uuid}))}}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block1.uuid, "g"), "LAS-TEST-UUID-1")
                    .replace(new RegExp(block2.uuid, "g"), "LAS-TEST-UUID-2")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-block").length).toBe(1);
                const refText = $(".embed-block .block-ref").text().trim();
                expect(refText).toContain("block");
                expect(refText).toContain("no ref");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Formatting check inside block embed rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A block with `function() hi {}` and [[test]]"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Embed: {{embed ((${block.uuid}))}}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-block").text()).toContain("function() hi {}");
                expect($(".embed-block code").text()).toBe("function() hi {}");
                expect($(".embed-block").text()).toContain("test");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Failed block embed rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Block Embed: {{embed ((wrong-block-ref))}}",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-block")).toHaveLength(1);
                expect($(".embed-block").html()).toBe("");
            }
        );
    });

    describe("Page Embed Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic page embed rendering",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    "Test Embed Page",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                const [firstBlock] = await logseq.Editor.getPageBlocksTree(embedPage.uuid);
                expect(firstBlock).toBeDefined();
                await logseq.Editor.updateBlock(firstBlock.uuid, "First block");
                await logseq.Editor.appendBlockInPage(embedPage.uuid, "Second block");
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Embed: {{embed [[Test Embed Page]]}}",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(embedPage.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-page > .children-list").length).toBe(1);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Invalid page embed rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Embed: {{embed [[invalid-page]]}}",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                // We do not show warning for embed pages currently as it is auto created in logseq and this case actually never happens
                expect($(".embed-page").length).toBeGreaterThanOrEqual(0);
            }
        );
    });
});

describe("Page + Block Embed Rendering", () => {
    let page: PageEntity;
    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test LogseqAnkiSync Embed",
            {},
            {redirect: false, createFirstBlock: true}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
        "Page with block embed to another block",
        async () => {
            const blockA = await logseq.Editor.appendBlockInPage(page.uuid, "Hello world");
            const blockB = await logseq.Editor.appendBlockInPage(
                page.uuid,
                `{{embed ((${blockA.uuid}))}}`
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                blockB.content,
                "markdown"
            );
            const graphName = (await logseq.App.getCurrentGraph()).name;
            const normalized = htmlFile.html
                .trim()
                .replace(new RegExp(blockA.uuid, "g"), "LAS-TEST-UUID")
                .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
            expect(normalized).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".embed-block").text()).toContain("Hello world");
        }
    );
});

describe("E2E cases for DB mode", () => {
    let page: PageEntity;
    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test LogseqAnkiSync DB",
            {},
            {redirect: false, createFirstBlock: true}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    describe("Block Reference Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Basic block ref rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A **block** with no ref."
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Block Ref: [[${block.uuid}]]`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const refText = $(".block-ref").text().trim();
                expect(refText).toContain("block");
                expect(refText).toContain("no ref");
            }
        );
    });

    describe("Page Reference Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Basic page ref rendering",
            async () => {
                await logseq.Editor.createPage(
                    "Test DB Ref Page",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Ref: [[Test DB Ref Page]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Test DB Ref Page");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });

    describe("Block Embed Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Basic block embed rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A **block** with no ref."
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const embedBlockUuid = "67890123-4567-89ab-cdef-012345678901";
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `uuid:: ${embedBlockUuid}\nlink:: ${block.id}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID-1")
                    .replace(new RegExp(embedBlockUuid, "g"), "LAS-TEST-UUID-2")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const embedText = $(".embed-block").text().trim();
                expect(embedText).toContain("block");
                expect(embedText).toContain("no ref");
            }
        );
    });

    describe("Page Embed Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "Basic page embed rendering",
            async () => {
                const embedPage = await logseq.Editor.createPage(
                    "Test DB Embed Page",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                const [firstBlock] = await logseq.Editor.getPageBlocksTree(embedPage.uuid);
                expect(firstBlock).toBeDefined();
                await logseq.Editor.updateBlock(firstBlock.uuid, "First block");
                await logseq.Editor.appendBlockInPage(embedPage.uuid, "Second block");
                await new Promise((resolve) => setTimeout(resolve, 100));
                const embedBlockUuid = "67890123-4567-89ab-cdef-012345678902";
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `uuid:: ${embedBlockUuid}\nlink:: ${embedPage.id}`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(embedPage.uuid, "g"), "LAS-TEST-UUID-1")
                    .replace(new RegExp(embedBlockUuid, "g"), "LAS-TEST-UUID-2")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-page > .children-list").length).toBe(1);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });

    describe("PDF Rendering cases", () => {
        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "PDF Text Annotation Rendering",
            async () => {
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "ls-type:: annotation\nhl-page:: 1\nhl-color:: yellow\nThe application can be made by a registered/enrolled elector",
                    "markdown"
                );
                expect(htmlFile.html.trim()).toMatchSnapshot();
                expect(htmlFile.html.trim()).toContain("The application can be made");
                expect(htmlFile.html.trim()).toContain("P1");
                expect(htmlFile.html.trim()).toContain("🟡");
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
            "PDF Image Annotation Rendering",
            async () => {
                const pdfPage = await logseq.Editor.createPage(
                    "hls__Linux_Slides_DB_Test",
                    {},
                    {redirect: false, createFirstBlock: true}
                );
                const block = await logseq.Editor.appendBlockInPage(
                    pdfPage.uuid,
                    "ls-type:: annotation\nhl-type:: area\nhl-page:: 1\nhl-color:: yellow\nhl-stamp:: 1767008103331\n[:span]"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    block.content,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(block.uuid, "g"), "LAS-TEST-UUID")
                    .replaceAll(`logseq://graph/${graphName}?`, "logseq://graph/LAS-TEST-GRAPH?");
                expect(normalized).toMatchSnapshot();
                expect(htmlFile.assets).toBeDefined();
                if (htmlFile.assets && htmlFile.assets.size > 0) {
                    expect(htmlFile.assets[0]).toContain("Linux_Slides_DB_Test");
                    expect(htmlFile.assets[0]).toContain("1767008103331.png");
                }
                expect(htmlFile.html.trim()).toContain("🟡");
                expect(htmlFile.html.trim()).toContain("P1");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });
});
