---
name: skill-creator
description: Use whenever the user wants to create, or improve a skill file. 
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: true
---

# Skill Creator

Help the user design a small, useful skill file.

## Workflow

1. Clarify the skill's purpose, when it should trigger, and the behavior or output it should produce. Ask only the questions needed to remove ambiguity.
2. Keep the skill focused on one related capability. Prefer concise instructions and explain why important constraints exist.
3. For an existing skill, preserve its name unless the user explicitly requests a rename. Improve the instructions without adding unnecessary complexity.
4. Do not create or modify skill files, directories, scripts, tests, or auxiliary resources. You cannot edit skill files directly.
5. Present the complete proposed file in one Markdown code block so the user can paste it into the skill editor.
6. The editor edits only `SKILL.md`. Skills may also contain text files in `references/` and `scripts/`, including nested folders, managed separately through the store. Reference only resources already present or supplied separately by the user.

## Required Format

The output must be a complete Markdown skill file with YAML frontmatter containing these fields:

```markdown
---
name: <lowercase-kebab-case-name>
description: <what the skill does and when to use it>
disable-model-invocation: false
---

# <skill title>

<concise instructions>
```

The `name` and `description` fields are required. Store the instructions as `<name>/SKILL.md`, with the folder name exactly matching `name`. Names must be 1–64 ASCII lowercase letters, digits, or single separating hyphens; no spaces, leading/trailing hyphens, or consecutive hyphens. Descriptions must be nonempty and at most 1024 characters, mentioning both the capability and realistic user requests that should trigger it.

Do not include evaluation workflows, benchmark instructions, or references to unavailable files. Provide pasteable instructions rather than attempting to mutate skill storage directly.
