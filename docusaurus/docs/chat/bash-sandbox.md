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

Network access is limited by `src/core/just-bash-wrapper/network-allowlist.txt`. Each non-comment line is an HTTPS host whose apex and subdomains are allowed. Requests are limited to `GET`, `HEAD`, and `POST`; redirects are checked against the same list. Requests use browser fetch and therefore require the destination to permit CORS. Cross-origin redirects whose destination the browser hides are rejected rather than bypassing the allowlist.
