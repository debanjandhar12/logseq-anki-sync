---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Node.js is unavailable.

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
