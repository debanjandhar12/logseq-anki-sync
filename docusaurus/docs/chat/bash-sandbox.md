---
sidebar_position: 8
title: Bash Sandbox
---

The Bash tool runs in a virtual filesystem and cannot access host files. Python is disabled.

Sandboxed JavaScript is available through `qjs`. Built-in utility scripts are bundled with their npm dependencies during the plugin build and mounted read-only under `/home/user/utility-scripts`.

To fetch a public YouTube or Bilibili transcript:

```bash
qjs /home/user/utility-scripts/fetch-transcript.js 'VIDEO_URL'
```

The command returns JSON with the provider, video ID, language, and timestamped transcript segments.

Network access is limited by `src/core/just-bash-wrapper/network-allowlist.txt`. Each non-comment line is an HTTPS host whose apex and subdomains are allowed. Requests are limited to `GET`, `HEAD`, and `POST`. Requests use Logseq's patched fetch transport to avoid Electron iframe CORS restrictions. Logseq follows redirects in its host process; the plugin validates the returned final URL and discards responses that end at a non-allowlisted host, but the current Logseq API cannot expose redirect hops before they are requested.
