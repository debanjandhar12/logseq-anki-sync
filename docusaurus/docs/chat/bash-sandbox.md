---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Node.js is unavailable.

Plugin storage mounts support nested directories. Tool results at `/home/user/tool-results`, parsed PDF pages at `/home/user/anydoc-parse-results`, and skill resources at `/home/user/skills` are read-only. Bash refreshes these mounts before each tool execution, so newly stored files are available to directory traversal and shell wildcards immediately.

The sandbox identity is centralized through `VIR_ENV_USER`, the derived `VIR_ENV_USER_PATH`, and the hostname shared by Bash and Python. The current user is `user`, the current home path is `/home/user`, and the path is exposed to skill templates as `<% &virEnvUserPath %>`.

Skills use this layout:

```text
/home/user/skills/<name>/
├── SKILL.md
├── examples/
│   └── query.ds
├── references/
│   └── example.md
└── scripts/
    └── example.py
```

The skill tool advertises the virtual base directory and up to ten sorted resource paths. Use nested traversal or wildcards to discover more files, and read references on demand:

```bash
find /home/user/skills/logseq-datascript-queries -type f
cat /home/user/skills/logseq-datascript-queries/examples/FIND_ORIGINAL_PAGE_FROM_ALIAS.ds
ls /home/user/skills/*/SKILL.md
```

Scripts in skill folders can be read by Bash or passed to supported interpreters, such as `python /home/user/skills/my-skill/scripts/example.py`. The mount does not provide host execution or new language runtimes. See [Skills](./skills.md) for naming rules, editing, resource save semantics, and built-in updates.

Python 3.14 is available through the `python`, `python3`, and `py` commands, backed by Pyodide in an isolated Web Worker. It supports `-c`, script files, stdin, command arguments, and top-level `await`. Ordinary APIs including `open`, `pathlib`, `os.listdir`, and `json.load` can access files under `/home/user`.

Before each Python execution, the Bash `/home/user` subtree is copied into Pyodide. When Python exits, its creates, modifications, and deletions on writable mounts are written back. Changes may persist even if the script exits nonzero, as they can for a normal process.

The same `read`, `readexecute`, and `readwrite` mount permissions govern write-back. Read-only mode bits normally make Python raise `PermissionError` immediately. If a script uses `chmod` to bypass those bits, the host still rejects the write-back, reports the failure on stderr, and returns a nonzero command result.

Write-back also checks that affected host paths still match the captured snapshot. If Bash or plugin storage changes one of those paths while Python is running, the Python command reports a conflict instead of knowingly overwriting the newer value. Logseq storage does not provide an atomic compare-and-swap transaction, so external changes in the final check-to-write interval remain a narrow race.

Only `/home/user` is shared. Python's `/tmp`, site packages, and `micropip` packages remain private to the one-use Python runtime. There is no pip wheel cache. A snapshot or change set is limited to 16 MiB per file and 128 MiB total; oversized transfers fail with a clear error.

Use `micropip` to install compatible packages and pin exact versions. Package installations exist only for the current command. For example:

```bash
python - <<'PY'
import micropip
await micropip.install("scipy==1.18.0")
import numpy as np
print(np.sin(np.deg2rad(45)) ** 2)
PY
```

The built-in `working-with-bash` skill contains Python examples for public YouTube and Bilibili transcripts. YouTube uses the pinned `youtube-transcript-api` package. Bilibili uses its public HTTP APIs directly because available Bilibili Python libraries are not compatible with Pyodide.

The Pyodide interpreter and standard library are bundled with the plugin. Additional wheels are loaded from pinned, allowlisted HTTPS sources. Python runs in a one-use worker, so cancelling or timing out a command terminates the runtime and its private filesystem and package state.

Network access is limited by `src/core/just-bash-wrapper/network-allowlist.txt`. Requests are limited to `GET`, `HEAD`, and `POST`, omit browser credentials, have response-size and timeout limits, and use Logseq's patched fetch transport to avoid Electron iframe CORS restrictions. The plugin validates browser-visible redirect destinations and the final URL reported by Logseq before exposing a response to the sandbox. Logseq may follow redirects in its host process before reporting the final URL, so the plugin cannot reject an intermediate redirect before it is contacted.
