---
sidebar_position: 7
title: Skills
---

Skills give the chat assistant specialized instructions that it can load on demand. Each skill is a folder whose name exactly matches the `name` in its root `SKILL.md` frontmatter:

```text
skills/my-skill/
├── SKILL.md
├── references/
│   └── nested/example.md
└── scripts/
    └── example.py
```

## Instructions and validation

A minimal `SKILL.md` looks like this:

```markdown
---
name: my-skill
description: Explain when the assistant should load this skill.
---

# My skill

Instructions for the assistant go here.
```

- Names are 1–64 characters and contain only ASCII lowercase letters (`a`–`z`), digits (`0`–`9`), and single separating hyphens. Leading, trailing, and consecutive hyphens are invalid. Spaces, uppercase letters, underscores, dots, and non-ASCII characters are invalid. Names are validated as written, without trimming or automatic renaming.
- Descriptions must contain non-whitespace text and be at most 1024 characters, including surrounding whitespace.
- The existing plugin fields `disable-model-invocation`, `built-in-skill`, and `built-in-skill-user-controllable` accept booleans. Unknown frontmatter fields are preserved.
- Instructions support the plugin's templates. Loading a skill renders its body while retaining its frontmatter.

## Editing, renaming, and deleting

Open the **Skills Editor** from plugin settings to create or edit skills. It edits only `SKILL.md`; references and scripts are not editable or uploadable through this UI. New skills start with an unused valid name such as `new-skill` or `new-skill-2`. Inline diagnostics and save validation enforce the same metadata rules, and duplicate skill names are rejected.

Changing a user skill's frontmatter name renames its folder. Edits and renames preserve all current resource files, including nested files. Deleting a skill removes its entire folder and resources. Saving preflights the batch and writes destinations before removing obsolete source folders, supporting name swaps without losing resources. On a storage failure, the store attempts to restore affected folders and the editor retains the draft for retry; a nontransactional backend cannot guarantee atomic recovery if restoration also fails.

Built-in skills cannot be renamed, deleted, or have their instructions edited in this UI. The **Enabled** checkbox controls model invocation where the built-in explicitly allows that preference. Disabled skills are omitted from the model-visible list but can still be explicitly loaded by name.

## Text resources and programmatic saves

The `SkillStore.saveSkillFile(content, {references, scripts})` API accepts maps of resource-relative paths to text:

```ts
await SkillStore.saveSkillFile(content, {
    references: {"nested/example.md": "Reference text"},
    scripts: {"example.py": "print('hello')"}
});
```

Omitting a category preserves its files. Supplying a category replaces that category's complete contents; an empty map clears it. Saving instructions without options preserves resources. Paths may be nested and may include dotfiles, but must be canonical relative POSIX paths: no absolute paths, leading/trailing slashes, empty segments, `.` or `..` segments, backslashes, control characters, or Windows drive prefixes. File/directory collisions are rejected. Resources cannot escape their category or overwrite the root `SKILL.md`. Binary assets and additional script runtimes are not supported.

## Loading skills and Bash access

The skill tool takes `{"name": "my-skill"}` using names from the available skills list. It retains the normal success/error envelope; on success, `skillFileContent` contains an OpenCode-style wrapper:

```text
<skill_content name="my-skill">
# Skill: my-skill

<rendered SKILL.md content>

Base directory for this skill: /home/user/skills/my-skill
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>
<file>/home/user/skills/my-skill/references/nested/example.md</file>
<file>/home/user/skills/my-skill/scripts/example.py</file>
</skill_files>
</skill_content>
```

The list contains at most ten file paths, sorted deterministically, with every file named `SKILL.md` excluded. Resource contents are read on demand. Generated file-path tags escape XML metacharacters; an empty resource list has empty `skill_files` tags. For larger folders, discover all files with Bash:

```bash
find /home/user/skills/my-skill -type f
cat /home/user/skills/my-skill/references/nested/example.md
python /home/user/skills/my-skill/scripts/example.py
```

These are real paths in the [read-only Bash sandbox mount](./bash-sandbox.md), never host storage paths. Mounts refresh before each Bash tool execution, so editor additions, renames, and deletions are immediately discoverable. Scripts run only through interpreters already supported by the sandbox. Python has a separate filesystem; pass resource contents through stdin when a Python script needs them.

The built-in `logseq-datascript-queries` skill includes exactly two references: `references/TASKS_SCHEDULED_IN_RANGE.ds` and `references/TAG_TEXT_SEARCH_FAILS.ds`.

## Built-in updates

Initialization compares the complete built-in folder's paths and contents, ignoring only the root instruction file's `disable-model-invocation` preference. An unchanged bundle performs no writes and preserves that preference. Any other instruction or resource change reinstalls the bundled folder, removes extra files, and resets invocation to the bundled default. Obsolete valid built-in folders are removed recursively; user-owned or malformed occupied folders are preserved.

Legacy flat skill files are not migrated or exposed as folder-based skills. This storage change is intended for unreleased development data.
