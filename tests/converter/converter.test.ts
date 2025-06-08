import "@logseq/libs"
import * as cheerio from "cheerio";
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import { convertToHTMLFile } from "../../src/logseq/LogseqToHtmlConverter";
import {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";

describe("Basic Markdown Test (no references)", () => {
    describe("Basic Inline rendering", () => {
        test("Single line text rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello World", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('Hello World');
        });
        test("Multiline text rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello\nWorld", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toMatch(/Hello(\s|\n)*<br\/?>(\s|\n)*World/g);
        });
        test("Bold Rendering", async () => {
            const htmlFile = await convertToHTMLFile("This **bold** and this __bold__ too.", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('This <b>bold</b> and this <b>bold</b> too.');
        });
        test("Italic Rendering", async () => {
            const htmlFile = await convertToHTMLFile("This *italic* and this _italic_ too.", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('This <i>italic</i> and this <i>italic</i> too.');
        });
        test("HTML Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello <b>World</b>", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('Hello <b>World</b>');
        });
        test("Hiccup Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello [:b World]", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('b').text()).toBe('World');
        });
        test("Admonition Rendering - Important", async () => {
            const htmlFile = await convertToHTMLFile(`#+BEGIN_IMPORTANT
            Hello World.
            #+END_IMPORTANT`, "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.important').text()).toContain('Hello World.');
        });
        test("Admonition Rendering - Quote", async () => {
            const htmlFile = await convertToHTMLFile(`> Hello World.`, "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('blockquote').text()).toContain('Hello World.');
        });
        test("logseq block highlight / coloring", async () => {
            const htmlFile = await convertToHTMLFile(`background-color:: red\nHello World.`, "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('span').text()).toContain('Hello World.');
            expect($('span').hasClass('block-highlight-red')).toBe(true);
        });
        test("Code Rendering", async () => {
            const htmlFile = await convertToHTMLFile("``Hello`` `World`", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('<code>Hello</code> <code>World</code>');
        });
        test("Page Ref Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello [[Ref Test]]", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            const graphName = (await logseq.App.getCurrentGraph()).name;
            expect($('a').text()).toBe('Ref Test');
            expect($('a').attr('href')).toBe(`logseq://graph/${graphName}?page=Ref%20Test`);
        });
        test("Consecutive Page Ref Rendering - https://github.com/debanjandhar12/logseq-anki-sync/issues/101", async () => {
            const htmlFile = await convertToHTMLFile("[[Ref Test]][[Ref Test]] [[Ref Test]],[[Ref Test]]", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('a')).toHaveLength(4);
        });
        test("Https / Http URL Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello [World](https://example.com) https://example.com http://example.com", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('a')).toHaveLength(3);
            expect($('a').first().text()).toContain('World');
            expect($('a').first().attr('href')).toBe('https://example.com');
            expect($('a').last().text()).toContain('http://example.com');
            expect($('a').last().attr('href')).toBe('http://example.com');
        });
        test("MarginNote URL Parsing - https://github.com/debanjandhar12/logseq-anki-sync/issues/74", async () => {
            const htmlFile = await convertToHTMLFile("[Some notes](marginnote3app://note/8B11CF4A-DE3C-4A71-84G8-ODF5EE2EBO4C)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('a').text()).toBe('Some notes');
            expect($('a').attr('href')).toBe('marginnote3app://note/8B11CF4A-DE3C-4A71-84G8-ODF5EE2EBO4C');
        });
        test("Tag Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello #World", "markdown", {displayTags: true});
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('a').text()).toBe('#World');
            expect($('a').attr('data-ref')).toBe('World');
            const graphName = (await logseq.App.getCurrentGraph()).name;
            expect($('a').attr('href')).toBe(`logseq://graph/${graphName}?page=World`);
            const htmlFile2 = await convertToHTMLFile("Hello #World", "markdown");
            const $2 = cheerio.load(htmlFile2.html);
            expect($2('a').text()).toBe('');
            expect($2('a').attr('data-ref')).toBe('World');
        });
    });
    describe("Code Block rendering", () => {
        test("Inline Code Block", async () => {
            const htmlFile = await convertToHTMLFile("`function hello() { console.log('Hello World'); }`", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').text()).toContain('function hello() { console.log(\'Hello World\'); }');
        });
        test("Basic Code Block", async () => {
            const htmlFile = await convertToHTMLFile("```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Basic Code Block with ~~~ syntax", async () => {
            const htmlFile = await convertToHTMLFile("~~~\nfunction hello() {\n  console.log(`Hello World`);\n}\n~~~", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Two Basic Code Block - one after another", async () => {
            const htmlFile = await convertToHTMLFile("Test:\n```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```\n```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs')).toHaveLength(2);
            expect($('.hljs').first().text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
            expect($('.hljs').last().text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Code Block with spacing", async () => {
            const htmlFile = await convertToHTMLFile("   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Code Block with character first line", async () => {
            const htmlFile = await convertToHTMLFile("randomchar ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').length).toBe(0);
        });
        test("Everything after codeblock start line should be ignored", async () => {
            const htmlFile = await convertToHTMLFile("   ```js randomchar\nfunction hello() {\n  console.log(`Hello World`);\n}\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
            expect(htmlFile.html).not.toContain('randomchar');
        });
        test("Everything after codeblock end line should be ignored", async () => {
            const htmlFile = await convertToHTMLFile("```\nfunction hello() {\n  console.log(`Hello World`);\n}\n``` randomchar\nOk", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
            expect(htmlFile.html).not.toContain('randomchar');
        });
        test("Codeblock end line before should not have nonspace char before", async () => {
            const htmlFile = await convertToHTMLFile("   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\nrandomchar\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').length).toBe(0);
        });
        test("Sql with < char should not render &lt; #269 #79", async () => {
            const htmlFile = await convertToHTMLFile("```sql\nselect * from users where id < 1\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').length).toBe(1);
            expect($('.hljs').text()).not.toContain('&lt;');
        });
        test("HTML codeblocks works correctly #269", async () => {
            const htmlFile = await convertToHTMLFile("```html\n<!DOCTYPE html>\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').length).toBe(1);
            expect($('.hljs').text()).not.toContain('&lt;');
        });
    });
    describe("Block Math rendering", () => {
       test("Math with arrow - https://github.com/debanjandhar12/logseq-anki-sync/issues/24", async () => {
           const htmlFile = await convertToHTMLFile("$$<a,b>$$", "markdown");
           expect(htmlFile.html.trim()).toMatchSnapshot();
           const $ = cheerio.load(htmlFile.html);
           expect($('.mathblock').html()).toContain('&lt;a,b&gt;');
       });
    });
    describe("Media rendering", () => {
        test("Image Rendering - Local Image", async () => {
            const htmlFile = await convertToHTMLFile("![](./assets/image.png)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain('./assets/image.png');
            const $ = cheerio.load(htmlFile.html);
            expect($('img').attr('src')).toEqual('image.png');
        });

        test("Image Rendering - Web Image", async () => {
            const htmlFile = await convertToHTMLFile("![](https://example.com/image.png)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('img').attr('src')).toEqual('https://example.com/image.png');
        });

        test("Image Rendering - Image with Alt Text", async () => {
            const htmlFile = await convertToHTMLFile('![Alt Text](https://example.com/image.png)', "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('img').attr('alt')).toEqual('Alt Text');
        });

        test("Image Rendering - Image with Width and Height", async () => {
            const htmlFile = await convertToHTMLFile('![Alt Text](https://example.com/image.png){:width "100" :height "200"}', "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('img').attr('width')).toEqual('100');
            expect($('img').attr('height')).toEqual('200');
        });

        test("Audio Rendering - Local Audio", async () => {
            const htmlFile = await convertToHTMLFile("![](./assets/audio.mp3)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain('./assets/audio.mp3');
            expect(htmlFile.html).toContain('[sound:audio.mp3]');
        });

        test("Audio Rendering - Web Audio", async () => {
            const htmlFile = await convertToHTMLFile("![](https://example.com/audio.mp3)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html).toContain('[sound:https://example.com/audio.mp3]');
        });

        test("Video Rendering - Local Video", async () => {
            const htmlFile = await convertToHTMLFile("![](./assets/video.mp4)", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.assets).toContain('./assets/video.mp4');
            const $ = cheerio.load(htmlFile.html);
            expect($('video').attr('src')).toEqual('video.mp4');
        });
    });
    describe("PDF Rendering", () => {
       test("Basic PDF rendering", async () => {
              const htmlFile = await convertToHTMLFile("![Linux Slides 1.pdf](../assets/Linux_Slides_1_1673180335043_0.pdf)", "markdown");
              expect(htmlFile.html.trim()).toMatchSnapshot();
              // TODO: Add beauty to pdf links and check
       });
       test("PDF Text Annotation Rendering", async () => {
          const htmlFile = await convertToHTMLFile("ls-type::annotation\nhl-page::1\nhl-color::blue\nI am pdf page content", "markdown");
          expect(htmlFile.html.trim()).toMatchSnapshot();
          expect(htmlFile.html.trim()).toContain('I am pdf page content');
          expect(htmlFile.html.trim()).toContain('P1');
          expect(htmlFile.html.trim()).toContain('🔵');
       });
        test("PDF Text Annotation Rendering - no color", async () => {
            const htmlFile = await convertToHTMLFile("ls-type::annotation\nhl-page::1\nI am pdf page content", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('I am pdf page content');
            expect(htmlFile.html.trim()).toContain('P1');
            expect(htmlFile.html.trim()).toContain('📌');
        });
       test("PDF Image Annotation Rendering", async () => {
          const htmlFile = await convertToHTMLFile("id::65a22d2c-a245-4a3f-89cc-1b1a7b724abc\nls-type::annotation\nhl-type::area\nhl-page::1\nhl-color::blue\nhl-stamp::1673181377785\n[:span]", "markdown");
          expect(htmlFile.html.trim()).toMatchSnapshot();
           expect(htmlFile.assets).toContain('../assets//1_65a22d2c-a245-4a3f-89cc-1b1a7b724abc_1673181377785.png');
           const $ = cheerio.load(htmlFile.html);
           expect($('img').attr('src')).toEqual('1_65a22d2c-a245-4a3f-89cc-1b1a7b724abc_1673181377785.png');
           expect(htmlFile.html.trim()).toContain('🔵');
       });
    });
    describe("Latex Rendering", () => {
       test("Inline Latex Rendering", async () => {
              const htmlFile = await convertToHTMLFile("This is inline latex: $\\frac{1}{2}$", "markdown");
                expect(htmlFile.html.trim()).toMatchSnapshot();
                expect(htmlFile.html.trim()).toContain('\\(\\frac{1}{2}\\)');
       });
        test("Two Inline Latex Rendering", async () => {
            const htmlFile = await convertToHTMLFile("This is consecutive math: $\\frac{1}{2}$ $\\frac{3}{4}$", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('\\(\\frac{1}{2}\\)');
            expect(htmlFile.html.trim()).toContain('\\(\\frac{3}{4}\\)');
        });
       test("Block Latex Rendering", async () => {
                  const htmlFile = await convertToHTMLFile("This is block latex: $$\\frac{1}{2}$$", "markdown");
                 expect(htmlFile.html.trim()).toMatchSnapshot();
                 expect(htmlFile.html.trim()).toContain('\\[\\frac{1}{2}\\]');
       });
    });
    describe("Anki Clozes Cases", () => {
        test("Math inside table with clozes", async () => {
            const htmlFile = await convertToHTMLFile("| $\\frac{1}{ {{c2::2}} }$ | {{c1::$\\frac{1}{2}$}} |", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('table').text()).toContain('\\(\\frac{1}{ {{c2::2}} }\\)');
            expect($('table').text()).toContain('\\(\\frac{1}{2}\\)');
        });
        test("Clozes inside code", async () => {
            const htmlFile = await convertToHTMLFile("```\n{{c1 class}} Apple;\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.hljs').text()).toContain('{{c1 class}}');
            expect($('.hljs').text()).toContain('Apple');
        });
        test("Clozes on code block", async () => {
            const htmlFile = await convertToHTMLFile("{{c1::```\nclass Apple;\n```}}", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect(htmlFile.html.trim()).toMatch(/{{c1::\n(.|\n)*?\n\s*<span>}}<\/span>/g);
            expect($('.hljs').text()).toContain('class Apple;');
        });
    });
});

describe("Complex Markdown / Org Mode Rendering Cases", () => {
    test("Math inside table", async () => {
        const htmlFile = await convertToHTMLFile("| Hello | $\\frac{1}{2}$ |", "markdown");
        expect(htmlFile.html.trim()).toMatchSnapshot();
        const $ = cheerio.load(htmlFile.html);
        expect($('table').text()).toContain('\\(\\frac{1}{2}\\)');
    });
    test("https://github.com/debanjandhar12/logseq-anki-sync/issues/248", async () => {
        const htmlFile = await convertToHTMLFile('```mips\nlw $t0, 4($gp) # fetch N\nmult $t0, $t0, $t0 # N*N\nlw $t1, 4($gp) # fetch N\nori $t2, $zero, 3 # 3\nmult $t1, $t1, $t2 # 3*N\nadd $t2, $t0, $t1 # N*N + 3*N\nsw $t2, 0($gp)\n```', "markdown");
        expect(htmlFile.html.trim()).toMatchSnapshot();
        const $ = cheerio.load(htmlFile.html);
        expect($('.hljs').text()).toContain('lw $t0, 4($gp)');
    });
});

describe("Logseq Block References Rendering", () => {
    let prevPage : PageEntity | BlockEntity, page : PageEntity;
    beforeEach(async () => {
        prevPage = await logseq.Editor.getCurrentPage();
        page = await logseq.Editor.createPage('Test LogseqAnkiSync', {createFirstBlock: false});
    });

    afterEach(async () => {
        await logseq.Editor.deletePage('Test LogseqAnkiSync');
    });
    
    describe("Block Reference Rendering", () => {
        test("Basic block ref rendering", async () => {
            const block = await logseq.Editor.appendBlockInPage(page.uuid, "A **block** with no ref.", {properties:{id: '68454f3f-f6b7-4784-b13b-08892b8f21cb'}});
            const htmlFile = await convertToHTMLFile(`Block Ref: ((${block.uuid}))`, "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.block-ref').text()).toContain('A block with no ref.');
            expect($('.block-ref b').text()).toContain('block'); // Ref content has a bold word - block
        });
        test("Failed block ref rendering", async () => {
            const htmlFile = await convertToHTMLFile("Block Ref: ((wrong-block-ref))", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.failed-block-ref').text()).toContain('wrong-block-ref');
        });
    });
    // describe("Block Embed Rendering", () => {
    //     test("Basic block embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d3c-954d-442b-8dca-4461fc209f84))}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-block').text()).toContain('A block with no ref.');
    //         expect($('.embed-block b').text()).toContain('block'); // Ref content has a bold word - block
    //     });
    //     test("Nested block embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d6d-bda8-47d0-a94a-235a0084dd5e))}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-block').length).toBe(2);
    //         expect($('.embed-block').first().text()).toContain('A block with page embed');
    //         expect($('.embed-block').last().text()).toContain('A block with no ref');
    //     });
    //     test("block ref inside block embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d50-f9d1-4527-ba45-6ada5c2eca9b))}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-block').length).toBe(1);
    //         expect($('.embed-block .block-ref').text()).toContain('A block with no ref.');
    //     });
    //     test("formatting inside block embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d87-a991-4322-b4b3-8e0b327acd1c))}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-block code').text()).toContain('function() hi {}');
    //         expect($('.embed-block a').first().attr('data-ref')).toEqual('test');
    //     });
    //     test("Failed block embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((wrong-block-ref))}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-block').text()).toContain('');
    //     });
    // });
    // describe("Page Embed Rendering", () => {
    //     test("Basic page embed rendering", async () => {
    //         const htmlFile = await convertToHTMLFile("Page Embed: {{embed [[Ref Test]]}}", "markdown");
    //         expect(htmlFile.html.trim()).toMatchSnapshot();
    //         const $ = cheerio.load(htmlFile.html);
    //         expect($('.embed-page > .children-list').length).toBe(1);
    //     });
    // });
});