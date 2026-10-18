---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Node.js is unavailable.

Plugin storage mounts support nested directories. Tool results at `/home/user/tool-results`, parsed PDF pages and EPUB sections at `/home/user/anydoc-parse-results`, and skill resources at `/home/user/skills` are read-only. Bash refreshes these mounts before each tool execution, so newly stored files are available to directory traversal and shell wildcards immediately. See [Document Parsing](./document-parsing.md) for supported formats and caching behavior.

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

Before each Python execution, the Bash `/home/user` subtree is copied into Pyodide as a read-only snapshot. The production Bash tool rejects shared-filesystem writes, including attempts to bypass Python's read-only mode bits with `chmod`.

Use the asynchronous `logseq_lib` module for persistent changes to Logseq pages, blocks, skills, command files, and assets. Methods accept one argument dictionary with camelCase keys and return ordinary Python values:

```python
import logseq_lib

page = await logseq_lib.create_page({"pageName": "Python notes"})
await logseq_lib.insert_block({
    "parentUuid": page["uuid"],
    "content": "Created through logseq_lib",
    "sibling": False,
})
```

Successful operations are recorded for undo, but a later Python error does not automatically roll them back. The filesystem snapshot does not refresh during a command; use `read_raw_skill` or `read_command_file` to read instructions saved earlier in that command.

Only `/home/user` is shared. Python's `/tmp`, site packages, and `micropip` packages remain private to the one-use Python runtime. There is no pip wheel cache. A snapshot or change set is limited to 16 MiB per file and 128 MiB total; oversized transfers fail with a clear error.

For maintainers, the bridge's shared types, content comparison, pure tree diff, and byte budgets live in `src/core/just-bash-wrapper/pyodide/sandbox-tree/`. Host storage reads and lower-level conflict-checked write-back support live in `just-bash-fs-bridge/`, while the Emscripten filesystem reader and loader live in `worker/`. Production Bash executions enforce read-only sharing even for otherwise writable adapters.

Use `micropip` to install compatible packages and pin exact versions. Package installations exist only for the current command. For example:

```bash
python - <<'PY'
import micropip
await micropip.install(["sympy==1.14.0", "mpmath==1.4.1"])
from sympy import Symbol, integrate, latex
x = Symbol("x")
print(latex(integrate(x**2, x)))
PY
```

The built-in `working-with-bash-and-pyodide` skill contains tested-source examples for symbolic integration, public video transcripts, method discovery, page creation, and skill creation. YouTube uses the pinned `youtube-transcript-api` package, whose synchronous HTTP transport requires a JSPI-capable browser; automated requests may be blocked. The installed `examples/BILIBILI_TRANSCRIPT.py` fetches a known public subtitle URL for Princeton Algorithms (`BV1Jt411P77c`, part 2). Bilibili can require login to discover subtitle URLs even when downloading a known URL is public.

The example tests execute the same Python sources included in the skill or installed as resources. In browser tests, `LogseqHttpProxy` routes external HTTPS requests through Vite's built-in `server.proxy` instead of Electron's `exper_request`, while local API calls and runtime assets stay on original fetch.

The Pyodide interpreter and standard library are bundled with the plugin. Additional wheels are loaded from pinned, allowlisted HTTPS sources. Python runs in a one-use worker, so cancelling or timing out a command terminates the runtime and its private filesystem and package state.

Network access is limited by `src/core/just-bash-wrapper/network/network-allowlist.txt`. Requests are limited to `GET`, `HEAD`, and `POST`, omit browser credentials, have response-size and timeout limits, and use Logseq's patched fetch transport to avoid Electron iframe CORS restrictions. The plugin validates browser-visible redirect destinations and the final URL reported by Logseq before exposing a response to the sandbox. Logseq may follow redirects in its host process before reporting the final URL, so the plugin cannot reject an intermediate redirect before it is contacted.
