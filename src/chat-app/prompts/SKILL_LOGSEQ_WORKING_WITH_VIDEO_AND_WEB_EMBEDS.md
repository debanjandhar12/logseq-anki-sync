---
name: Logseq Video and Web Embeds
description: Use when writing Logseq video / website embeds.
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: false
---

# Logseq Video and Web Embeds

## Macro Syntax

Use Logseq macros in block content with `{{macro-name parameters}}`.

## Video Embeds

Embed an online video in its own block:

```text
{{video https://www.youtube.com/watch?v=VIDEO_ID}}
```

Add a timestamp annotation as a child of the video block. `youtube-timestamp` accepts seconds.

```text
- {{video https://www.youtube.com/watch?v=VIDEO_ID}}
  - {{youtube-timestamp 263}} Comment at 4:23
```

- Use `{{youtube-timestamp ...}}` only in a child block of its video embed.
- Convert requested timestamps to seconds before writing the macro.
- When asked to add comments based on video content, fetch the online video's transcript first, then write the comments as timestamp children.
- Local video files do not expose a transcript through web fetch. Tell the user that transcript-based comments cannot be created for local videos.

## Tweet Embeds

Embed a post with:

```text
{{tweet https://x.com/USER/status/POST_ID}}
```

## Website Embeds

Use an inline iframe only to embed a website:

```html
<iframe src="https://example.com"></iframe>
```

- Prefer Markdown for normal content and formatting.
- Do not use HTML except when an iframe is necessary for a website embed.

## Avoid

- Do not use the obsolete `{{embed ...}}` macro. It is unsupported in DB graphs.
