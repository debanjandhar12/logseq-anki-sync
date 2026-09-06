import {describe, expect, test} from "vitest";
import {parseVideoInput} from "../../../../src/core/utility-script-init/scripts/fetch-transcript/parseVideoInput";

describe("fetch-transcript input parsing", () => {
    test("parses YouTube URLs and IDs", () => {
        expect(parseVideoInput("dQw4w9WgXcQ")).toEqual({
            provider: "youtube",
            videoId: "dQw4w9WgXcQ",
            page: 1
        });
        expect(parseVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
            provider: "youtube",
            videoId: "dQw4w9WgXcQ",
            page: 1
        });
    });

    test("parses Bilibili URLs and page numbers", () => {
        expect(parseVideoInput("https://www.bilibili.com/video/BV1PSt362ERp?p=2")).toEqual({
            provider: "bilibili",
            videoId: "BV1PSt362ERp",
            page: 2
        });
    });

    test("rejects unsupported or malformed input", () => {
        expect(() => parseVideoInput("https://example.com/video/1")).toThrow(/Only YouTube/);
        expect(() => parseVideoInput("https://youtube.com/watch?v=bad")).toThrow(/Invalid YouTube/);
        expect(() => parseVideoInput("https://bilibili.com/video/BV123?p=0")).toThrow(
            /Invalid Bilibili/
        );
    });
});
