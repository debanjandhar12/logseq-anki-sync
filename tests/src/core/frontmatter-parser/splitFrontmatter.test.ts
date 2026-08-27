import matter from "gray-matter";
import {describe, expect, test} from "vitest";
import {splitFrontmatter} from "../../../../src/core/frontmatter-parser";

describe("splitFrontmatter", () => {
    test.each([
        "---\nname: Test\n---\nBody",
        "---\r\nname: Test\r\n---\r\nBody",
        "---\nname: Test\n--- trailing\nBody",
        "---\nname: Test\n---Body",
        "---\nname: Test\ndescription: Test"
    ])("matches gray-matter content for %j", (source) => {
        const split = splitFrontmatter(source);

        expect(split.prefix + split.body).toBe(source);
        expect(split.body).toBe(matter(source, {}).content);
    });

    test.each([
        "Body",
        "----\nBody"
    ])("leaves non-frontmatter source untouched for %j", (source) => {
        expect(splitFrontmatter(source)).toEqual({
            prefix: "",
            body: source,
            matterRange: null
        });
    });

    test("returns a half-open raw matter range", () => {
        const source = "---\nname: Test\n---\nBody";
        const {matterRange} = splitFrontmatter(source);

        expect(matterRange && source.slice(matterRange.from, matterRange.to)).toBe("\nname: Test");
    });
});
