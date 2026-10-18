import json
from js import fetch

# Script to fetch transcript from bilibili
# https://www.bilibili.com/video/BV1Jt411P77c/?p=2 (CID 106132694)
# Anonymous subtitle discovery usually requires login, but this known subtitle URL is public.
subtitle_url = (
    "https://i0.hdslb.com/bfs/subtitle/"
    "9d71b0913bed9966fcccb99d211208d31290ad09.json"
)
response = await fetch(subtitle_url)
if not response.ok:
    raise RuntimeError(f"Bilibili subtitle request failed: HTTP {response.status}")

subtitle = (await response.json()).to_py()
segments = subtitle.get("body")
if not isinstance(segments, list) or not segments:
    raise RuntimeError("Bilibili returned no subtitle segments")

print(json.dumps(segments, ensure_ascii=False))
