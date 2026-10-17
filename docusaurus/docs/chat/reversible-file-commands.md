# Reversible file commands

The transaction tracker provides file operations for internal callers. These commands are not registered as chat tools, and asset diffs are not yet displayed in the diff viewer.

## Commands

- `PutSkillFileCommand({skillName, content})` creates or updates `SKILL.md`, preserving every auxiliary file.
- `DeleteSkillFileCommand({skillName})` deletes the complete skill folder. Undo restores every captured relative path, including custom folders.
- `ReadSkillFileCommand({skillName})` reads the exact Markdown, without rendering templates.
- `PutCommandFileCommand({commandName, content})`, `DeleteCommandFileCommand({commandName})`, and `ReadCommandFileCommand({commandName})` operate on the corresponding command Markdown file. Pass the command identity, not a filesystem path; the store adds `.md`.
- `PutAssetFileCommand({assetPath, contentBase64})` writes decoded binary bytes. Content must be nonempty standard padded base64.
- `ReadAssetFileCommand({assetPath})` reads binary bytes as base64.

Markdown put operations require nonblank, valid frontmatter and template syntax. The argument name must match the frontmatter name. User operations cannot create built-ins or delete them; built-in updates permit only the explicitly user-controllable setting, matching the editors.

Read results contain `exists` and either `content` or `contentBase64`, with `null` for missing files. Existing empty files are distinct from missing files. Read commands follow the same execute/revert status lifecycle as other commands, but do not mutate files.

## Asset paths and host requirements

Asset commands require the desktop host's filesystem IPC and fetch capabilities. Supported inputs are `assets/file`, `./assets/file`, Logseq's `../assets/file` convention, and absolute filesystem paths inside the current graph's assets directory. Bare assets-relative names and URLs are rejected. Paths are normalized and checked for lexical containment; symlink targets are not resolved by this check.

Generic asset writes cannot target this plugin's storage root, preventing bypass of skill and command protections. They do not create Logseq database asset blocks or mark database pages as changed. Undo captures the original bytes as base64, restores overwritten files (including empty originals), or unlinks newly created files. Asset undo refuses to operate after switching graphs.

## Tracking and persistence

Internal file helpers are grouped in `AssetFileOperations` (desktop asset I/O and snapshot restoration) and `StoredFileOperations` (raw Markdown reads and storage identities). Asset input validation lives in `PutAssetFileCommandArgsSchema`; the snapshot schema is colocated with `AssetFileOperations`. Binary conversion uses the existing `buffer` library. Path containment remains a separate pure resolver.

`getChangedAssets()` returns graph-relative, slash-separated paths, for example:

```text
assets/images/example.png
assets/storages/<plugin-id>/skills/example/SKILL.md
assets/storages/<plugin-id>/commands/Example.md
```

The tracker deduplicates paths, retains them through undo for subsequent comparison, and clears them on `clear()`. Both command undo snapshots and tracker asset paths survive JSON serialization. Legacy tracker data without `changedAssets` loads with an empty list.

`SkillStore.saveSkillFile(content, options)` retains its existing merge behavior. Its trusted snapshot overload, `saveSkillFile({skillName, files})`, restores an exact relative-path-to-text map using the store's existing rollback machinery; it is not a user-edit validation API.
