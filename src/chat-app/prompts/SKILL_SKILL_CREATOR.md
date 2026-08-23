---
name: Skill Creator
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
6. Do not use nested skill / resource files. It is not supported.

## Required Format

The output must be a complete Markdown skill file with YAML frontmatter containing these fields:

```markdown
---
name: <skill name>
description: <what the skill does and when to use it>
disable-model-invocation: false
---

# <skill title>

<concise instructions>
```

The `name`, `description`, and `disable-model-invocation` fields are required. The description should mention both the capability and realistic user requests that should trigger it. 

Do not include evaluation workflows, benchmark instructions, Python commands, nested resource folders, or references to files that are not included in the pasted skill.