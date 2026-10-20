import * as cheerio from "cheerio";
import {describe, expect, test} from "vitest";
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
