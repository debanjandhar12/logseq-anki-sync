---
name: Working with Bash
description: Use when running isolated Bash commands, processing data, working with Python, or performing math and numerical calculations.
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: false
---

# Working with Bash

The Bash tool runs in an isolated virtual filesystem and cannot access host files. Node.js is unavailable. Use `python` or `python3` to run Python 3.14 in browser-compatible Pyodide:

```bash
python -c 'print(", ".join(map(str, sorted([3, 1, 2]))))'
```

Python uses a separate empty filesystem. Pipe Bash file contents into a `python -c` command and return generated data through stdout instead of opening Bash paths from Python.

Top-level `await` is supported. Install Pyodide-compatible packages with `micropip`, always pin exact versions, and perform the installation and use in the same command. Packages are not preserved between commands. Network requests must use allowlisted HTTPS hosts.

## Math

Install SciPy with micropip and calculate `sin(45 degrees) ** 2`:

```bash
python - <<'PY'
import micropip
await micropip.install("scipy==1.18.0")
import numpy as np
print(np.sin(np.deg2rad(45)) ** 2)
PY
```

The result is approximately `0.5`. Loading SciPy for the first time downloads a large WebAssembly wheel and can take longer than standard-library calculations.

## Video Transcripts

Fetch a public YouTube transcript with `youtube-transcript-api`:

```bash
python - <<'PY'
import json
import micropip
await micropip.install("youtube-transcript-api==1.2.4")
from youtube_transcript_api import YouTubeTranscriptApi

transcript = YouTubeTranscriptApi().fetch("VIDEO_ID", languages=["en"])
print(json.dumps(transcript.to_raw_data(), ensure_ascii=False))
PY
```

No maintained Bilibili subtitle package has a Pyodide-compatible dependency set. Fetch public Bilibili subtitles directly with Python and the secured browser fetch bridge:

```bash
python - <<'PY'
import json
from js import fetch
from urllib.parse import urlencode, urljoin

bvid = "BV_VIDEO_ID"

async def get_json(url):
    response = await fetch(url)
    if not response.ok:
        raise RuntimeError(f"HTTP {response.status}: {url}")
    return (await response.json()).to_py()

pages = await get_json(
    "https://api.bilibili.com/x/player/pagelist?" + urlencode({"bvid": bvid})
)
page_list = pages.get("data") or []
if not page_list:
    raise RuntimeError("Bilibili returned no video pages")

cid = page_list[0].get("cid")
player = await get_json(
    "https://api.bilibili.com/x/player/v2?" + urlencode({"bvid": bvid, "cid": cid})
)
tracks = ((player.get("data") or {}).get("subtitle") or {}).get("subtitles") or []
if not tracks:
    raise RuntimeError("This video has no public subtitle track")

subtitle_url = urljoin("https://www.bilibili.com", tracks[0]["subtitle_url"])
subtitle = await get_json(subtitle_url)
print(json.dumps(subtitle.get("body") or [], ensure_ascii=False))
PY
```

Public subtitles are not available for every video. YouTube can reject automated transcript requests, and some Bilibili subtitles require an authenticated session that the sandbox does not receive.
