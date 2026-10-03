import {getSkillFileMetadata} from "./getSkillFileMetadata";

export function createNewSkillContent(
    contents: readonly string[],
    reservedNames: Iterable<string> = []
): string {
    const names = new Set([
        ...reservedNames,
        ...contents.map((content) => getSkillFileMetadata(content)?.name)
    ]);
    let name = "new-skill";
    for (let suffix = 2; names.has(name); suffix += 1) name = `new-skill-${suffix}`;
    return `---
name: ${name}
description: Describe what this skill does
disable-model-invocation: false
---

# New skill
`;
}
