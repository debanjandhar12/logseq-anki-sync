---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Node.js is unavailable.

Plugin storage mounts support nested directories. Tool results at `/home/user/tool-results`, parsed PDF pages at `/home/user/anydoc-parse-results`, and skill resources at `/home/user/skills` are read-only. Bash refreshes these mounts before each tool execution, so newly stored files are available to directory traversal and shell wildcards immediately.

The folder-based skill storage foundation uses this layout:

```text
/home/user/skills/<name>/
├── SKILL.md
├── references/
│   └── example.md
└── scripts/
    └── example.py
```

The new `SkillStore.saveSkillFile(content, {references, scripts})` API accepts maps of relative filenames to text. Names use lowercase letters, digits, and single separating hyphens (1–64 characters); descriptions are nonempty and at most 1024 characters. An omitted resource category preserves its files; a supplied category replaces its files, and an empty map clears it. Resource paths cannot contain traversal segments or escape the skill folder. Folder hashes include file paths and contents, so reference and script changes are detectable as well as instruction changes.

This is the storage foundation: the current skill editor, skill tool, and built-in installer still use the existing flat skill files until the folder integration is completed. Scripts in the new folders can be read by Bash or passed to supported interpreters; the mount does not provide host execution or new language runtimes.

`SkillStore.hashSkillFiles(name)` discovers and hashes every stored file recursively, including files in deeply nested or auxiliary folders. The root `SKILL.md` is hashed separately so its invocation frontmatter can be ignored during built-in comparisons. All other files are hashed from sorted relative paths and exact contents, then the instruction and resource hashes are combined into one versioned digest. SHA-256 uses `@noble/hashes` and does not require browser Web Crypto or a secure context.

Python 3.14 is available through the `python` and `python3` commands, backed by Pyodide in an isolated Web Worker. It supports `-c`, script files, stdin, command arguments, and top-level `await`.

The command adapter can load a selected script from the Bash filesystem, but Python receives a separate empty filesystem. Pass Bash file contents through stdin when Python needs to process them, and write generated data to stdout for a later Bash command.

Use `micropip` to install compatible packages and pin exact versions. Package installations exist only for the current command. For example:

```bash
python - <<'PY'
import micropip
await micropip.install("scipy==1.18.0")
import numpy as np
print(np.sin(np.deg2rad(45)) ** 2)
PY
```

The built-in `Working with Bash` skill contains Python examples for public YouTube and Bilibili transcripts. YouTube uses the pinned `youtube-transcript-api` package. Bilibili uses its public HTTP APIs directly because available Bilibili Python libraries are not compatible with Pyodide.

The Pyodide interpreter and standard library are bundled with the plugin. Additional wheels are loaded from pinned, allowlisted HTTPS sources. Python runs in a one-use worker, so cancelling or timing out a command terminates the runtime and package state.

Network access is limited by `src/core/just-bash-wrapper/network-allowlist.txt`. Requests are limited to `GET`, `HEAD`, and `POST`, omit browser credentials, have response-size and timeout limits, and use Logseq's patched fetch transport to avoid Electron iframe CORS restrictions. The plugin validates browser-visible redirect destinations and the final URL reported by Logseq before exposing a response to the sandbox. Logseq may follow redirects in its host process before reporting the final URL, so the plugin cannot reject an intermediate redirect before it is contacted.
