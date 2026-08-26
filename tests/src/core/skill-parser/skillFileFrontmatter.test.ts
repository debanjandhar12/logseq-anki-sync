import matter from "gray-matter";
import {describe, expect, test} from "vitest";
import {splitSkillFileFrontmatter} from "../../../../src/core/skill-parser/skillFileFrontmatter";

describe("splitSkillFileFrontmatter", () => {
    test.each([
        "---\nname: Test\n---\nBody",
        "---\r\nname: Test\r\n---\r\nBody",
        "---\nname: Test\n--- trailing\nBody",
        "---\nname: Test\n---Body",
        "---\nname: Test\ndescription: Test"
    ])("matches gray-matter content for %j", (source) => {
        const split = splitSkillFileFrontmatter(source);

        expect(split.prefix + split.body).toBe(source);
        expect(split.body).toBe(matter(source, {}).content);
    });

    test.each([
        "Body",
        "----\nBody"
    ])("leaves non-frontmatter source untouched for %j", (source) => {
        expect(splitSkillFileFrontmatter(source)).toEqual({
            prefix: "",
            body: source,
            matterRange: null
        });
    });

    test("returns a half-open raw matter range", () => {
        const source = "---\nname: Test\n---\nBody";
        const {matterRange} = splitSkillFileFrontmatter(source);

        expect(matterRange && source.slice(matterRange.from, matterRange.to)).toBe("\nname: Test");
    });
});
