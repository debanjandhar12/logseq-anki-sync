import "@logseq/libs";
import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import * as cheerio from "cheerio";
import {afterEach, beforeEach, describe, expect, test} from "vitest";
import getNameFromPage from "../../../src/logseq/getNameFromPage";
import {LogseqContentPreprocessor} from "../../../src/logseq/LogseqContentPreprocessor";
import {LogseqToHtmlConverter} from "../../../src/logseq/LogseqToHtmlConverter";

describe("Basic Markdown Cases", () => {
    describe("Basic Inline rendering", () => {
        test("Single line text rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello World",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("Hello World");
        });
        test("Multiline text rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello\nWorld",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toMatch(/Hello(\s|\n)*<br\/?>(\s|\n)*World/g);
        });
        test("Bold Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "This **bold** and this __bold__ too.",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("This <b>bold</b> and this <b>bold</b> too.");
        });
        test("Italic Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "This *italic* and this _italic_ too.",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain(
                "This <i>italic</i> and this <i>italic</i> too."
            );
        });
        test("Property parsing should work and removed from HTML content", async () => {
            const content = "logseq.text-color:: green\nHello World\nbackground-color:: red";
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(content, "markdown");
            const preprocessResult = await LogseqContentPreprocessor.preprocess(
                content,
                "markdown"
            );
            expect(htmlFile.html).toContain("Hello World");
            expect(preprocessResult.properties["logseq.text-color"]).not.toBeNull();
            expect(preprocessResult.properties["logseq.text-color"]).toContain("green");
            expect(preprocessResult.properties["background-color"]).not.toBeNull();
            expect(preprocessResult.properties["background-color"]).toContain("red");
            expect(htmlFile.html).not.toContain("background-color::");
        });
        test("HTML Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello <b>World</b>",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("Hello <b>World</b>");
        });
        test("Hiccup Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello [:b World]",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("b").text()).toBe("World");
        });
        test("Admonition Rendering - Important", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                `#+BEGIN_IMPORTANT
            Hello World.
            #+END_IMPORTANT`,
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".important").text()).toContain("Hello World.");
        });
        test("Admonition Rendering - Quote", async () => {
            // This is deprecated in db version but kept for backward compatibility
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                `> Hello World.`,
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("blockquote").text()).toContain("Hello World.");
        });
        test("logseq block highlight / coloring", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                `background-color:: red\nHello World.`,
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("span").text()).toContain("Hello World.");
            expect($("span").hasClass("block-highlight-red")).toBe(true);
        });
        test("Code Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "``Hello`` `World`",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("<code>Hello</code> <code>World</code>");
        });
        test.skipIf(!globalThis.isLogseqAvailable)("Page Ref Rendering", async () => {
            // Create the page that will be referenced
            await logseq.Editor.createPage("Ref Test", {}, {createFirstBlock: false});
            await new Promise((resolve) => setTimeout(resolve, 100));

            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello [[Ref Test]]",
                "markdown"
            );
            const graphName = (await logseq.App.getCurrentGraph()).name;
            const normalized = htmlFile.html
                .trim()
                .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
            expect(normalized).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("a").text()).toBe("Ref Test");
            expect($("a").attr("href")).toBe(`logseq://graph/${graphName}?page=Ref%20Test`);

            // Cleanup
            await logseq.Editor.deletePage("Ref Test");
            await new Promise((resolve) => setTimeout(resolve, 100));
        });
        test.skipIf(!globalThis.isLogseqAvailable)(
            "Consecutive Page Ref Rendering - https://github.com/debanjandhar12/logseq-anki-sync/issues/101",
            async () => {
                // Create the page that will be referenced
                await logseq.Editor.createPage("Ref Test", {}, {createFirstBlock: false});
                await new Promise((resolve) => setTimeout(resolve, 100));

                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "[[Ref Test]][[Ref Test]] [[Ref Test]],[[Ref Test]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($("a")).toHaveLength(4);

                // Cleanup
                await logseq.Editor.deletePage("Ref Test");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
        test("Https / Http URL Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello [World](https://example.com) https://example.com http://example.com",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("a")).toHaveLength(3);
            expect($("a").first().text()).toContain("World");
            expect($("a").first().attr("href")).toBe("https://example.com");
            expect($("a").last().text()).toContain("http://example.com");
            expect($("a").last().attr("href")).toBe("http://example.com");
        });
        test("MarginNote URL Parsing - https://github.com/debanjandhar12/logseq-anki-sync/issues/74", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "[Some notes](marginnote3app://note/8B11CF4A-DE3C-4A71-84G8-ODF5EE2EBO4C)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("a").text()).toBe("Some notes");
            expect($("a").attr("href")).toBe(
                "marginnote3app://note/8B11CF4A-DE3C-4A71-84G8-ODF5EE2EBO4C"
            );
        });
        test.skipIf(!globalThis.isLogseqAvailable)("Tag Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Hello #World",
                "markdown",
                {displayTags: true}
            );
            const graphName = (await logseq.App.getCurrentGraph()).name;
            const normalized = htmlFile.html
                .trim()
                .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
    describe("Code Block rendering", () => {
        test("Inline Code Block", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "`function hello() { console.log('Hello World'); }`",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("code").text()).toContain("function hello() { console.log('Hello World'); }");
        });
        test("Basic Code Block", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
        });
        test("Basic Code Block with ~~~ syntax", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "~~~\nfunction hello() {\n  console.log(`Hello World`);\n}\n~~~",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
        });
        test("Two Basic Code Block - one after another", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "Test:\n```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```\n```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs")).toHaveLength(2);
            expect($(".hljs").first().text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
            expect($(".hljs").last().text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
        });
        test("Code Block with spacing", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
        });
        test("Code Block with character first line", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "randomchar ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").length).toBe(0);
        });
        test("Everything after codeblock start line should be ignored", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "   ```js randomchar\nfunction hello() {\n  console.log(`Hello World`);\n}\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
            expect(htmlFile.html).not.toContain("randomchar");
        });
        test("Everything after codeblock end line should be ignored", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "```\nfunction hello() {\n  console.log(`Hello World`);\n}\n``` randomchar\nOk",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain(
                "function hello() {\n  console.log(`Hello World`);\n}"
            );
            expect(htmlFile.html).not.toContain("randomchar");
        });
        test("Codeblock end line before should not have nonspace char before", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\nrandomchar\t ```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").length).toBe(0);
        });
        test("Sql with < char should not render &lt; #269 #79", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "```sql\nselect * from users where id < 1\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").length).toBe(1);
            expect($(".hljs").text()).not.toContain("&lt;");
        });
        test("HTML codeblocks works correctly #269", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "```html\n<!DOCTYPE html>\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").length).toBe(1);
            expect($(".hljs").text()).not.toContain("&lt;");
        });
    });
    describe("Block Math rendering", () => {
        test("Math with arrow - https://github.com/debanjandhar12/logseq-anki-sync/issues/24", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile("$$<a,b>$$", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".mathblock").html()).toContain("&lt;a,b&gt;");
        });
    });
    describe("Media rendering", () => {
        test("Image Rendering - Local Image", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![](./assets/image.png)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain("./assets/image.png");
            const $ = cheerio.load(htmlFile.html);
            expect($("img").attr("src")).toEqual("image.png");
            expect(htmlFile.assets.size).toBe(1);
        });

        test("Image Rendering - Web Image", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![](https://example.com/image.png)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("img").attr("src")).toEqual("https://example.com/image.png");
            expect(htmlFile.assets.size).toBe(0);
        });

        test("Image Rendering - Image with Alt Text", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![Alt Text](https://example.com/image.png)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("img").attr("alt")).toEqual("Alt Text");
        });

        test("Image Rendering - Image with Width and Height", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                '![Alt Text](https://example.com/image.png){:width "100" :height "200"}',
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("img").attr("width")).toEqual("100");
            expect($("img").attr("height")).toEqual("200");
        });

        test("Audio Rendering - Local Audio", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![](./assets/audio.mp3)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain("./assets/audio.mp3");
            expect(htmlFile.html).toContain("[sound:audio.mp3]");
            expect(htmlFile.assets.size).toBe(1);
        });

        test("Audio Rendering - Web Audio", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![](https://example.com/audio.mp3)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html).toContain("[sound:https://example.com/audio.mp3]");
            expect(htmlFile.assets.size).toBe(0);
        });

        test("Video Rendering - Local Video", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "![](./assets/video.mp4)",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain("./assets/video.mp4");
            const $ = cheerio.load(htmlFile.html);
            expect($("video").attr("src")).toEqual("video.mp4");
            expect(htmlFile.assets.size).toBe(1);
        });
    });
    describe("Latex Rendering", () => {
        test("Inline Latex Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "This is inline latex: $\\frac{1}{2}$",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("\\(\\frac{1}{2}\\)");
        });
        test("Two Inline Latex Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "This is consecutive math: $\\frac{1}{2}$ $\\frac{3}{4}$",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("\\(\\frac{1}{2}\\)");
            expect(htmlFile.html.trim()).toContain("\\(\\frac{3}{4}\\)");
        });
        test("Block Latex Rendering", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "This is block latex: $$\\frac{1}{2}$$",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain("\\[\\frac{1}{2}\\]");
        });
    });
    describe("Anki Clozes Cases", () => {
        test("Math inside table with clozes", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "| $\\frac{1}{ {{c2::2}} }$ | {{c1::$\\frac{1}{2}$}} |",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($("table").text()).toContain("\\(\\frac{1}{ {{c2::2}} }\\)");
            expect($("table").text()).toContain("\\(\\frac{1}{2}\\)");
        });
        test("Clozes inside code", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "```\n{{c1 class}} Apple;\n```",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($(".hljs").text()).toContain("{{c1 class}}");
            expect($(".hljs").text()).toContain("Apple");
        });
        test("Clozes on code block", async () => {
            const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                "{{c1::```\nclass Apple;\n```}}",
                "markdown"
            );
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect(htmlFile.html.trim()).toMatch(/{{c1::\n(.|\n)*?\n\s*<span>}}<\/span>/g);
            expect($(".hljs").text()).toContain("class Apple;");
        });
    });
});

describe("E2E cases for non DB mode", () => {
    let page: PageEntity;
    beforeEach(async () => {
        page = await logseq.Editor.createPage(
            "Test LogseqAnkiSync",
            {},
            {redirect: false, createFirstBlock: false}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        await logseq.Editor.deletePage("Test LogseqAnkiSync");
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
                    {redirect: false, createFirstBlock: false}
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                expect(htmlFile.assets).toBeDefined();
                if (htmlFile.assets && htmlFile.assets.size > 0) {
                    expect(htmlFile.assets[0]).toContain("Linux_Slides_Test");
                    expect(htmlFile.assets[0]).toContain("1673181377785.png");
                }
                expect(htmlFile.html.trim()).toContain("🔵");
                expect(htmlFile.html.trim()).toContain("P1");
                await logseq.Editor.deletePage("hls__Linux_Slides_Test");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });

    describe("Block Reference Rendering", () => {
        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Basic block ref rendering",
            async () => {
                const block = await logseq.Editor.appendBlockInPage(
                    page.uuid,
                    "A **block** with no ref.",
                    {properties: {id: "68454f3f-f6b7-4784-b13b-08892b8f21cb"}}
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const refText = $(".block-ref").text().trim();
                expect(refText).toContain("block");
                expect(refText).toContain("no ref");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
                    {redirect: false, createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Ref: [[Test Ref Page]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Test Ref Page");
                await logseq.Editor.deletePage("Test Ref Page");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );

        test.skipIf(!globalThis.isLogseqAvailable || globalThis.isLogseqCurrentIsDBGraph)(
            "Renamed page ref rendering",
            async () => {
                const refPage = await logseq.Editor.createPage(
                    "Original Page Name",
                    {},
                    {redirect: false, createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    `Page Ref: [Renamed Page]([[${getNameFromPage(refPage)}]])`,
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Renamed Page");
                await logseq.Editor.deletePage("Original Page Name");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                const embedText = $(".embed-block").text().trim();
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-block").text()).toContain("function() hi {}");
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
                expect($(".embed-block").text()).toContain("");
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
                    {redirect: false, createFirstBlock: false}
                );
                await logseq.Editor.appendBlockInPage(embedPage.uuid, "First block");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-page > .children-list").length).toBe(1);
                await logseq.Editor.deletePage("Test Embed Page");
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
                expect(htmlFile.html.trim()).toMatchSnapshot();
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
            {redirect: false, createFirstBlock: false}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        await logseq.Editor.deletePage("Test LogseqAnkiSync Embed");
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
                .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
            {redirect: false, createFirstBlock: false}
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        await logseq.Editor.deletePage("Test LogseqAnkiSync DB");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
                    {redirect: false, createFirstBlock: false}
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
                    "Page Ref: [[Test DB Ref Page]]",
                    "markdown"
                );
                const graphName = (await logseq.App.getCurrentGraph()).name;
                const normalized = htmlFile.html
                    .trim()
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".page-reference").text()).toContain("Test DB Ref Page");
                await logseq.Editor.deletePage("Test DB Ref Page");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
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
                    {redirect: false, createFirstBlock: false}
                );
                await logseq.Editor.appendBlockInPage(embedPage.uuid, "First block");
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                const $ = cheerio.load(htmlFile.html);
                expect($(".embed-page > .children-list").length).toBe(1);
                await logseq.Editor.deletePage(getNameFromPage(embedPage));
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
                    {redirect: false, createFirstBlock: false}
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
                    .replace(new RegExp(graphName, "g"), "LAS-TEST-GRAPH");
                expect(normalized).toMatchSnapshot();
                expect(htmlFile.assets).toBeDefined();
                if (htmlFile.assets && htmlFile.assets.size > 0) {
                    expect(htmlFile.assets[0]).toContain("Linux_Slides_DB_Test");
                    expect(htmlFile.assets[0]).toContain("1767008103331.png");
                }
                expect(htmlFile.html.trim()).toContain("🟡");
                expect(htmlFile.html.trim()).toContain("P1");
                await logseq.Editor.deletePage("hls__Linux_Slides_DB_Test");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        );
    });
});

describe("Regression Cases", () => {
    test("Math inside table", async () => {
        const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
            "| Hello | $\\frac{1}{2}$ |",
            "markdown"
        );
        expect(htmlFile.html.trim()).toMatchSnapshot();
        const $ = cheerio.load(htmlFile.html);
        expect($("table").text()).toContain("\\(\\frac{1}{2}\\)");
    });
    test("https://github.com/debanjandhar12/logseq-anki-sync/issues/248", async () => {
        const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
            "```mips\nlw $t0, 4($gp) # fetch N\nmult $t0, $t0, $t0 # N*N\nlw $t1, 4($gp) # fetch N\nori $t2, $zero, 3 # 3\nmult $t1, $t1, $t2 # 3*N\nadd $t2, $t0, $t1 # N*N + 3*N\nsw $t2, 0($gp)\n```",
            "markdown"
        );
        expect(htmlFile.html.trim()).toMatchSnapshot();
        const $ = cheerio.load(htmlFile.html);
        expect($(".hljs").text()).toContain("lw $t0, 4($gp)");
    });
    test("https://github.com/debanjandhar12/logseq-anki-sync/discussions/89#discussioncomment-13399053", async () => {
        const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
            "{{c1:: $\\frac{1}{\\sqrt{2}}$}}",
            "markdown"
        );
        expect(htmlFile.html.trim()).toMatchSnapshot();
    });
    test("Swift cloze rendering with numbered list - https://github.com/debanjandhar12/logseq-anki-sync/issues/326", async () => {
        const htmlFile = await LogseqToHtmlConverter.convertToHTMLFile(
            "{{c2::test 3}} :<-> {{c1::test}}\nlogseq.order-list-type:: number",
            "markdown"
        );
        expect(htmlFile.html).toContain("{{c2::test 3}}");
        expect(htmlFile.html).toContain("{{c1::test}}");
    });
});
