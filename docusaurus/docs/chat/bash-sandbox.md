---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Python and Node.js are unavailable.

Sandboxed JavaScript is available through `qjs`. It supports top-level `await` and ES module imports from allowlisted HTTPS hosts. Imports require full URLs and should pin package versions.

For example, import mathjs from jsDelivr:

```bash
qjs -e 'import {evaluate} from "https://cdn.jsdelivr.net/npm/mathjs@14.9.1/+esm"; console.log(evaluate("sin(45 deg) ^ 2"))'
```

The built-in `Working with Bash` skill contains examples for fetching public YouTube and Bilibili transcripts.

Network access is limited by `src/core/just-bash-wrapper/network-allowlist.txt`. Each non-comment line is an HTTPS host whose apex and subdomains are allowed. Requests are limited to `GET`, `HEAD`, and `POST`. Requests use Logseq's patched fetch transport to avoid Electron iframe CORS restrictions. Logseq follows redirects in its host process; the plugin validates the returned final URL and discards responses that end at a non-allowlisted host, but the current Logseq API cannot expose redirect hops before they are requested.
