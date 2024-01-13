import {describe, expect, it, test, vi} from 'vitest';
import {BlockIdentity, EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import * as cheerio from "cheerio";

let allBlocks = [
    {
        "properties": {
            "tags": [
                "Test"
            ]
        },
        "parent": {
            "id": 57
        },
        "children": [],
        "invalidProperties": [],
        "id": 58,
        "pathRefs": [
            {
                "id": 57
            },
            {
                "id": 62
            }
        ],
        "propertiesTextValues": {
            "tags": "Test"
        },
        "level": 1,
        "uuid": "65a22d2c-a245-4a3f-89cc-1b1a7b724abc",
        "content": "tags:: Test",
        "journal?": false,
        "page": {
            "id": 57
        },
        "preBlock?": true,
        "propertiesOrder": [
            "tags"
        ],
        "left": {
            "id": 57
        },
        "format": "markdown",
        "refs": [
            {
                "id": 62
            }
        ]
    },
    {
        "properties": {
            "id": "65a22d3c-954d-442b-8dca-4461fc209f84"
        },
        "parent": {
            "id": 57
        },
        "children": [],
        "id": 63,
        "pathRefs": [
            {
                "id": 57
            }
        ],
        "propertiesTextValues": {
            "id": "65a22d3c-954d-442b-8dca-4461fc209f84"
        },
        "level": 1,
        "uuid": "65a22d3c-954d-442b-8dca-4461fc209f84",
        "content": "A **block** with no ref.\nid:: 65a22d3c-954d-442b-8dca-4461fc209f84\n\nSome more content...",
        "journal?": false,
        "page": {
            "id": 57
        },
        "propertiesOrder": [
            "id"
        ],
        "left": {
            "id": 58
        },
        "format": "markdown"
    },
    {
        "properties": {
            "id": "65a22d50-f9d1-4527-ba45-6ada5c2eca9b"
        },
        "parent": {
            "id": 57
        },
        "children": [],
        "id": 64,
        "pathRefs": [
            {
                "id": 57
            },
            {
                "id": 63
            }
        ],
        "propertiesTextValues": {
            "id": "65a22d50-f9d1-4527-ba45-6ada5c2eca9b"
        },
        "level": 1,
        "uuid": "65a22d50-f9d1-4527-ba45-6ada5c2eca9b",
        "content": "A block with block ref:\nid:: 65a22d50-f9d1-4527-ba45-6ada5c2eca9b\n((65a22d3c-954d-442b-8dca-4461fc209f84))",
        "journal?": false,
        "page": {
            "id": 57
        },
        "propertiesOrder": [
            "id"
        ],
        "left": {
            "id": 63
        },
        "format": "markdown",
        "refs": [
            {
                "id": 63
            }
        ]
    },
    {
        "properties": {
            "id": "65a22d6d-bda8-47d0-a94a-235a0084dd5e"
        },
        "parent": {
            "id": 57
        },
        "children": [],
        "id": 65,
        "pathRefs": [
            {
                "id": 57
            },
            {
                "id": 63
            },
            {
                "id": 66
            }
        ],
        "propertiesTextValues": {
            "id": "65a22d6d-bda8-47d0-a94a-235a0084dd5e"
        },
        "level": 1,
        "uuid": "65a22d6d-bda8-47d0-a94a-235a0084dd5e",
        "content": "A block with page embed:\nid:: 65a22d6d-bda8-47d0-a94a-235a0084dd5e\n{{embed ((65a22d3c-954d-442b-8dca-4461fc209f84))}}",
        "journal?": false,
        "macros": [
            {
                "id": 67
            }
        ],
        "page": {
            "id": 57
        },
        "propertiesOrder": [
            "id"
        ],
        "left": {
            "id": 64
        },
        "format": "markdown",
        "refs": [
            {
                "id": 63
            },
            {
                "id": 66
            }
        ]
    },
    {
        "properties": {
            "id": "65a22d87-a991-4322-b4b3-8e0b327acd1c"
        },
        "parent": {
            "id": 57
        },
        "children": [
            {
                "properties": {},
                "parent": {
                    "id": 69
                },
                "children": [
                    {
                        "properties": {},
                        "parent": {
                            "id": 71
                        },
                        "children": [],
                        "id": 74,
                        "pathRefs": [
                            {
                                "id": 57
                            },
                            {
                                "id": 62
                            }
                        ],
                        "level": 3,
                        "uuid": "65a22ec8-6320-429a-b033-741e5329c93d",
                        "content": "nested child 1.1",
                        "journal?": false,
                        "page": {
                            "id": 57
                        },
                        "left": {
                            "id": 71
                        },
                        "format": "markdown"
                    }
                ],
                "id": 71,
                "pathRefs": [
                    {
                        "id": 57
                    },
                    {
                        "id": 62
                    }
                ],
                "level": 2,
                "uuid": "65a22eb3-b994-48c8-98f5-a52c46dde256",
                "content": "nested child 1",
                "journal?": false,
                "page": {
                    "id": 57
                },
                "left": {
                    "id": 69
                },
                "format": "markdown"
            },
            {
                "properties": {},
                "parent": {
                    "id": 69
                },
                "children": [],
                "id": 73,
                "pathRefs": [
                    {
                        "id": 57
                    },
                    {
                        "id": 62
                    }
                ],
                "level": 2,
                "uuid": "65a22ec3-1dfc-4dec-8634-6401665e6b82",
                "content": "nested child 2",
                "journal?": false,
                "page": {
                    "id": 57
                },
                "left": {
                    "id": 71
                },
                "format": "markdown"
            }
        ],
        "id": 69,
        "pathRefs": [
            {
                "id": 57
            },
            {
                "id": 62
            }
        ],
        "propertiesTextValues": {
            "id": "65a22d87-a991-4322-b4b3-8e0b327acd1c"
        },
        "level": 1,
        "uuid": "65a22d87-a991-4322-b4b3-8e0b327acd1c",
        "content": "Another block with no ref. ```\nfunction() hi {}\n```\n#test [[Test]] [Testing]([[Test]])\nid:: 65a22d87-a991-4322-b4b3-8e0b327acd1c",
        "journal?": false,
        "page": {
            "id": 57
        },
        "collapsed?": true,
        "propertiesOrder": [
            "id"
        ],
        "left": {
            "id": 65
        },
        "format": "markdown",
        "refs": [
            {
                "id": 62
            }
        ]
    },
    {
        "properties": {},
        "parent": {
            "id": 57
        },
        "children": [],
        "id": 75,
        "pathRefs": [
            {
                "id": 57
            },
            {
                "id": 69
            },
            {
                "id": 81
            }
        ],
        "level": 1,
        "uuid": "65a22edc-3fdb-49ed-b61d-a2ffc221522d",
        "content": "Another block with page embed:\n{{embed ((65a22d87-a991-4322-b4b3-8e0b327acd1c))}}",
        "journal?": false,
        "macros": [
            {
                "id": 82
            }
        ],
        "page": {
            "id": 57
        },
        "left": {
            "id": 69
        },
        "format": "markdown",
        "refs": [
            {
                "id": 69
            },
            {
                "id": 81
            }
        ]
    }
];
vi.mock('../../src/logseq/LogseqProxy', () => ({
    LogseqProxy: {
        Editor: {
            getBlock: vi.fn().mockImplementation(async (srcBlock: BlockIdentity | EntityID, opts: Partial<{
                includeChildren: boolean
            }>) => {
                // TODO: Add support for opts.includeChildren
                srcBlock = typeof srcBlock === "string" ? srcBlock.toLowerCase() : srcBlock;
                let foundBlock = allBlocks.find(b => b.uuid === srcBlock);
                return foundBlock;
            }),
            getPage: vi.fn().mockImplementation(async (srcPage: PageIdentity | EntityID) => {
                srcPage = typeof srcPage === "string" ? srcPage.toLowerCase() : srcPage;
                switch (srcPage) {
                    case "ref test":
                    case "65a22d2c-8b99-4897-a097-f5bdb6bfee5c":
                        return {
                            "properties": {
                                "tags": [
                                    "Test"
                                ]
                            },
                            "updatedAt": 1705127448282,
                            "createdAt": 1705127212440,
                            "tags": [
                                {
                                    "id": 62
                                }
                            ],
                            "id": 57,
                            "propertiesTextValues": {
                                "tags": "Test"
                            },
                            "name": "ref test",
                            "uuid": "65a22d2c-8b99-4897-a097-f5bdb6bfee5c",
                            "journal?": false,
                            "originalName": "Ref Test",
                            "file": {
                                "id": 61
                            },
                            "format": "markdown"
                        };
                        break;
                    default:
                        return null;
                }
            }),
            getPageBlocksTree: vi.fn().mockImplementation(async (srcPage: PageIdentity | EntityID) => {
                srcPage = typeof srcPage === "string" ? srcPage.toLowerCase() : srcPage;
                switch (srcPage) {
                    case "ref test":
                    case "65a22d2c-8b99-4897-a097-f5bdb6bfee5c":
                        return allBlocks.filter(b => b.page.id === 57);
                        break;
                    default:
                        return [];
                }
            }),
        }
    }
}));

global.logseq = {
    // @ts-ignore
    settings: {
        debug: []   // Add Converter.ts in array to enable debug logs
    },
    // @ts-ignore
    App: {
        getCurrentGraph: vi.fn().mockReturnValue({
            "url": "logseq_local_/home/Graphs/TestGraph",
            "name": "TestGraph",
            "path": "/home/deban/home/Graphs/TestGraph"
        }),
    }
};

import {convertToHTMLFile} from '../../src/converter/Converter';

describe("Markdown Input", () => {
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
        test("Code Rendering", async () => {
            const htmlFile = await convertToHTMLFile("``Hello`` `World`", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            expect(htmlFile.html.trim()).toContain('<code>Hello</code> <code>World</code>');
        });
        test("Page Ref Rendering", async () => {
            const htmlFile = await convertToHTMLFile("Hello [[Ref Test]]", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('a').text()).toContain('Ref Test');
            expect($('a').attr('href')).toBe('logseq://graph/TestGraph?page=Ref%20Test');
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
            expect($('a').text()).toContain('Some notes');
            expect($('a').attr('href')).toBe('marginnote3app://note/8B11CF4A-DE3C-4A71-84G8-ODF5EE2EBO4C');
        });
    });
    describe("Code Block rendering", () => {
        test("Basic Code Block", async () => {
            const htmlFile = await convertToHTMLFile("```\nfunction hello() {\n  console.log(`Hello World`);\n}\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Code Block with spacing", async () => {
            const htmlFile = await convertToHTMLFile("   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
        });
        test("Code Block with character first line", async () => {
            const htmlFile = await convertToHTMLFile("a ```\nfunction hello() {\n  console.log(`Hello World`);\n}\n\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').length).toBe(0);
        });
        test("Everything after codeblock start line should be ignored", async () => {
            const htmlFile = await convertToHTMLFile("   ```js randomchar\nfunction hello() {\n  console.log(`Hello World`);\n}\n```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
            expect(htmlFile.html).not.toContain('randomchar');
        });
        test("Everything after codeblock end line should be ignored", async () => {
            const htmlFile = await convertToHTMLFile("```\nfunction hello() {\n  console.log(`Hello World`);\n}\n``` randomchar\nOk", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').text()).toContain('function hello() {\n  console.log(`Hello World`);\n}');
            expect(htmlFile.html).not.toContain('randomchar');
        });
        test("Codeblock end line before should not have nonspace char before", async () => {
            const htmlFile = await convertToHTMLFile("   ```\nfunction hello() {\n  console.log(`Hello World`);\n}\nrandomchar\t ```", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('code').length).toBe(0);
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
    });
    describe("Block Reference Rendering", () => {
        test("Basic block ref rendering", async () => {
            const htmlFile = await convertToHTMLFile("Block Ref: ((65a22d3c-954d-442b-8dca-4461fc209f84))", "markdown");
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
    describe("Block Embed Rendering", () => {
        test("Basic block embed rendering", async () => {
            const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d3c-954d-442b-8dca-4461fc209f84))}}", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.embed-block').text()).toContain('A block with no ref.');
            expect($('.embed-block b').text()).toContain('block'); // Ref content has a bold word - block
        });
        test("Nested block embed rendering", async () => {
           const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d6d-bda8-47d0-a94a-235a0084dd5e))}}", "markdown");
           expect(htmlFile.html.trim()).toMatchSnapshot();
           const $ = cheerio.load(htmlFile.html);
           expect($('.embed-block').length).toBe(2);
           expect($('.embed-block').first().text()).toContain('A block with page embed');
           expect($('.embed-block').last().text()).toContain('A block with no ref');
        });
        test("block ref inside block embed rendering", async () => {
            const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d50-f9d1-4527-ba45-6ada5c2eca9b))}}", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.embed-block').length).toBe(1);
            expect($('.embed-block .block-ref').text()).toContain('A block with no ref.');
        });
        test("formatting inside block embed rendering", async () => {
            const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((65a22d87-a991-4322-b4b3-8e0b327acd1c))}}", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.embed-block code').text()).toContain('function() hi {}');
            expect($('.embed-block a').first().text()).toContain('test');
        });
        test("Failed block embed rendering", async () => {
            const htmlFile = await convertToHTMLFile("Page Embed: {{embed ((wrong-block-ref))}}", "markdown");
            expect(htmlFile.html.trim()).toMatchSnapshot();
            const $ = cheerio.load(htmlFile.html);
            expect($('.embed-block').text()).toContain('');
        });
    });
    describe("Page Embed Rendering", () => {
       test("Basic page embed rendering", async () => {
          const htmlFile = await convertToHTMLFile("Page Embed: {{embed [[Ref Test]]}}", "markdown");
          expect(htmlFile.html.trim()).toMatchSnapshot();
          const $ = cheerio.load(htmlFile.html);
          expect($('.embed-page > .children-list').length).toBe(1);
          expect($('.embed-page  .children-list').length).toBe(7);
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
});
