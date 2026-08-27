import {describe, expect, test} from "vitest";
import {parseSkillFile} from "../../../../src/core/skill-parser";

describe("parseSkillFile", () => {
    test("parses valid skill frontmatter", () => {
        expect(
            parseSkillFile(`---
name: Test skill
description: Test description
built-in-skill: true
built-in-skill-user-controllable: true
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
built-in-skill: true
built-in-skill-user-controllable: true
disable-model-invocation: false
---

# Body
`,
            builtInSkill: true,
            builtInSkillUserControllable: true,
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

    test("rejects invalid built-in-skill metadata", () => {
        expect(() =>
            parseSkillFile(`---
name: Test skill
description: Test description
built-in-skill: yes
---

# Body
`)
        ).toThrow("built-in-skill must be a boolean");
    });

    test("rejects invalid built-in-skill-user-controllable metadata", () => {
        expect(() =>
            parseSkillFile(`---
name: Test skill
description: Test description
built-in-skill-user-controllable: enabled
---

# Body
`)
        ).toThrow("built-in-skill-user-controllable must be a boolean");
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

    test("throws the first metadata issue", () => {
        expect(() =>
            parseSkillFile(`---
name: 42
built-in-skill: enabled
---`)
        ).toThrow("name is required");
    });
});
