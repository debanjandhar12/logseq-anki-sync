---
name: Working with Bash
description: Use when running isolated Bash commands, processing data, working with JavaScript, or performing math and numerical calculations.
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: false
---

# Working with Bash

The Bash tool runs in an isolated virtual filesystem and cannot access host files. Python and Node.js are unavailable.

Use `qjs` for sandboxed JavaScript. Pass short ES modules with `-e`:

```bash
qjs -e 'console.log([3, 1, 2].sort((a, b) => a - b).join(", "))'
```

Top-level `await` and ES module imports are supported. Network requests and imports must use full HTTPS URLs on allowlisted hosts. Pin imported packages to specific versions.

## Math

Import mathjs from jsDelivr and calculate `sin(45 deg) ^ 2`:

```bash
qjs -e 'import {evaluate} from "https://cdn.jsdelivr.net/npm/mathjs@14.9.1/+esm"; console.log(evaluate("sin(45 deg) ^ 2"))'
```

The result is approximately `0.5`.

## Video Transcripts

Fetch a public YouTube transcript by importing `youtube-caption-extractor` from jsDelivr:

```bash
qjs -e 'import {getSubtitles} from "https://cdn.jsdelivr.net/npm/youtube-caption-extractor@1.10.2/+esm"; const subtitles = await getSubtitles({videoID: "VIDEO_ID", lang: "en", fetch}); console.log(JSON.stringify(subtitles))'
```

Fetch the first public subtitle track for a Bilibili video with its API:

```bash
qjs -e 'const bvid = "BV_VIDEO_ID"; const pages = await (await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`)).json(); const cid = pages.data[0].cid; const player = await (await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`)).json(); const track = player.data.subtitle.subtitles[0]; const url = new URL(track.subtitle_url, "https://www.bilibili.com"); console.log(JSON.stringify(await (await fetch(url.href)).json()))'
```

Public subtitles are not available for every video. Check that the returned page, player, and subtitle data exist before relying on them in a longer command.
