import {beforeEach, describe, expect, test, vi} from "vitest";
import {LogseqToHtmlConverter} from "../../../src/logseq/LogseqToHtmlConverter";

vi.hoisted(() => {
    globalThis.logseq = {settings: {}} as any;
});
vi.mock("@logseq/libs", () => ({}));

const uuid = "11111111-1111-4111-8111-111111111111";
let block: any;

beforeEach(() => {
    block = null;
    vi.stubGlobal("logseq", {
        settings: {inheritPropertiesFromTags: false},
        App: {
            checkCurrentIsDbGraph: async () => false,
            getCurrentGraph: async () => ({name: "synthetic"})
        },
        Editor: {
            getBlock: async () => structuredClone(block),
            getBlockProperties: async () => ({}),
            getPage: async () => ({
                id: 10,
                name: "hls__fixture",
                originalName: "hls__fixture",
                properties: {}
            }),
            getPageProperties: async () => ({})
        }
    });
});

describe("synthetic block reference conversion", () => {
    test("PDF text annotation is formatted once", async () => {
        block = {
            uuid,
            content: "Synthetic excerpt\nls-type:: annotation\nhl-page:: 3\nhl-color:: yellow",
            format: "markdown"
        };
        const result = await LogseqToHtmlConverter.convertToHTMLFile(`((${uuid}))`);
        expect(result.html.match(/P3/g)).toHaveLength(1);
        expect(result.html).toContain("Synthetic excerpt");
    });
    test("PDF area annotation emits one image and retains the annotation text", async () => {
        block = {
            uuid,
            page: {id: 10},
            content: `Synthetic caption\nid:: ${uuid}\nls-type:: annotation\nhl-type:: area\nhl-page:: 3\nhl-stamp:: 42\nhl-color:: yellow`,
            format: "markdown"
        };
        const result = await LogseqToHtmlConverter.convertToHTMLFile(`((${uuid}))`);
        expect(result.html.match(/<img /g)).toHaveLength(1);
        expect(result.html.match(/P3/g)).toHaveLength(1);
        expect(result.html).toContain("Synthetic caption");
        expect(result.assets.size).toBe(1);
    });
    test("ordinary references keep first-line and color behavior", async () => {
        block = {
            uuid,
            content: "First line\nSecond line\nbackground-color:: red",
            format: "markdown"
        };
        const result = await LogseqToHtmlConverter.convertToHTMLFile(`((${uuid}))`);
        expect(result.html).toContain("First line");
        expect(result.html).not.toContain("Second line");
        expect(result.html).toContain("block-highlight-red");
    });
});
