import {describe, expect, test} from "vitest";
import {parseSkillFile} from "../../../../src/core/skill-parser/parseSkillFile";

describe("parseSkillFile", () => {
    test("parses valid skill frontmatter", () => {
        expect(
            parseSkillFile(`---
name: Test skill
description: Test description
default-installed-skill: true
disable-model-invocation: false
---

# Body
`)
        ).toEqual({
            name: "Test skill",
            description: "Test description",
            content: `---
name: Test skill
description: Test description
default-installed-skill: true
disable-model-invocation: false
---

# Body
`,
            defaultInstalledSkill: true,
            disableModelInvocation: false
        });
    });

    test("rejects missing frontmatter", () => {
        expect(() => parseSkillFile("# Body")).toThrow("frontmatter is required");
    });

    test("rejects missing name", () => {
        expect(() =>
            parseSkillFile(`---
description: Test description
---

# Body
`)
        ).toThrow("name is required");
    });

    test("rejects missing description", () => {
        expect(() =>
            parseSkillFile(`---
name: Test skill
---

# Body
`)
        ).toThrow("description is required");
    });

    test("rejects invalid boolean metadata", () => {
        expect(() =>
            parseSkillFile(`---
name: Test skill
description: Test description
default-installed-skill: yes
---

# Body
`)
        ).toThrow("default-installed-skill must be a boolean");
    });

    test("rejects invalid disable-model-invocation metadata", () => {
        expect(() =>
            parseSkillFile(`---
name: Test skill
description: Test description
disable-model-invocation: disabled
---

# Body
`)
        ).toThrow("disable-model-invocation must be a boolean");
    });
});
