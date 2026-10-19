# Reversible file commands

The transaction tracker provides file operations for internal callers. These commands are not registered as individual chat tools. Review & Commit includes tracked files alongside page changes, including changes made through Bash/Pyodide `logseq_lib`.

## Reviewing file changes

Text assets use the same split line-diff presentation as pages. Raster images show labeled Before/After panes (stacked on narrow screens), using captured bytes so the proposed image remains visible after the transaction is reverted for review. SVG, HTML, and XML are displayed as source text, never active markup. Other binary files show metadata instead of a content preview.

The unified content limit is **32 MiB for each Before/After side**, for both text and images. Larger files are not fetched for preview. Metadata-only and image-decode warnings do not block approval, but actual read/validation failures do. When content could not be captured, identical sizes are not assumed to mean identical bytes; the asset remains listed with an equality warning. The limit is not an aggregate memory or text-rendering budget.

All file previews use the desktop asset transport, both for ordinary graph assets and files under this plugin's storage directory. Missing desktop capabilities produce a review error rather than silently hiding changes. Asset-only transactions are reviewable; only transactions with no net page or asset changes are treated as empty.

Review captures the applied state, reverts recorded commands, then captures the original state. Approval replays those commands (not the Python source); rejection discards the already-reverted transaction, while closing or deferring preserves the existing pending-change lifecycle. Preview payloads are transient and are not added to thread artifacts; existing command undo snapshots still contain serialized file bytes as described below.

## Commands

- `PutSkillFileCommand({skillName, content})` creates or updates `SKILL.md`, preserving every auxiliary file.
- `DeleteSkillFileCommand({skillName})` deletes the complete skill folder. Undo restores every captured relative path, including custom folders.
- `ReadSkillFileCommand({skillName})` reads the exact Markdown, without rendering templates.
- `PutCommandFileCommand({commandName, content})`, `DeleteCommandFileCommand({commandName})`, and `ReadCommandFileCommand({commandName})` operate on the corresponding command Markdown file. Pass the command identity, not a filesystem path; the store adds `.md`.
- `PutAssetFileCommand({assetPath, contentBase64})` writes decoded binary bytes. Content must be nonempty standard padded base64.
- `ReadAssetFileCommand({assetPath})` reads binary bytes as base64.

Markdown put operations require nonblank, valid frontmatter and template syntax. The argument name must match the frontmatter name. User operations cannot create built-ins or delete them; built-in updates permit only the explicitly user-controllable setting, matching the editors.

Name validation has two owners: parser schemas describe frontmatter names, while storage validation checks generated command filenames (including `.md`). Command format names need only be nonblank strings; transaction arguments and editor saves additionally enforce storage-safe identities, rejecting paths, forbidden filename characters, and trailing dots/spaces. Raw transaction identities also reject surrounding whitespace; frontmatter readers retain their existing whitespace trimming before deriving filenames. Skill names retain their lowercase/digit/single-hyphen grammar and 1–64 character limit. Case-insensitive command collisions are checked across the collection, not by the name schema. This separation does not change accepted names or stored filenames.

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
