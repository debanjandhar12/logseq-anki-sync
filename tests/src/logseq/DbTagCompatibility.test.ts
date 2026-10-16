import {beforeEach, expect, test, vi} from "vitest";
import {LogseqPropertiesHelper} from "../../../src/logseq/LogseqPropertiesHelper";
import {LogseqToHtmlConverter} from "../../../src/logseq/LogseqToHtmlConverter";
import {TagParser} from "../../../src/sync/parsers/TagParser";

vi.hoisted(() => {
    globalThis.logseq = {settings: {}} as any;
});
vi.mock("@logseq/libs", () => ({}));
const uuid = "22222222-2222-4222-8222-222222222222";
const cardTag = {id: 143, name: "card"};
const topicTag = {id: 144, name: "study/topic"};

beforeEach(() => {
    vi.stubGlobal("logseq", {
        settings: {inheritPropertiesFromTags: false},
        App: {checkCurrentIsDbGraph: async () => true},
        Editor: {
            getBlock: async () => ({
                uuid,
                content: "Synthetic question",
                format: "markdown",
                page: {id: 10},
                tags: [cardTag],
                properties: {tags: [cardTag, topicTag]}
            }),
            getBlockProperties: async () => ({}),
            getPage: async () => ({id: 10, name: "synthetic", properties: {tags: [topicTag]}}),
            getPageProperties: async () => ({})
        }
    });
});

test("DB Card tags are normalized before rendering and Anki tag parsing", async () => {
    const normalized = await LogseqPropertiesHelper.getBlock(uuid);
    expect(normalized!.properties.tags).toEqual(["card", "study/topic"]);
    const result = await LogseqToHtmlConverter.convertToHTMLFile(normalized!.content);
    expect(result.html).toContain("Synthetic question");
    const tags = await TagParser.parse({uuid, pageId: 10} as any, []);
    expect(tags).toContain("study::topic");
    expect(tags).toContain("card");
});

test("DB page property tags use the same boundary normalization", async () => {
    const page = await LogseqPropertiesHelper.getPage(10);
    expect(page!.properties.tags).toEqual(["study/topic"]);
});

test("mixed string and entity tag sources retain names and tag ids", () => {
    const result = LogseqPropertiesHelper.handleTagProperty({tags: [cardTag]} as any, {
        tags: ["plain", topicTag],
        ":block/tags": [cardTag]
    });
    expect(result.tags).toEqual(["plain", "study/topic", "card"]);
    expect(result.tagIds).toEqual([143]);
});
