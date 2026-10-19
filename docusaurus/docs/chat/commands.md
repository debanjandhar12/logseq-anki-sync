# Commands

Commands populate the AI chat composer from a Markdown prompt, optionally including
the block or page from which they were invoked as an attachment. Edit user commands
in the Command Editor.

## Built-in transformation commands

These commands start a new chat thread with the selected block or page attached:

- **Transcribe Video** is available for video blocks. It retrieves captions and adds
  transcript passages as direct children of the video, each with its own timestamp.
  Caption fragments are grouped into complete sentences or coherent passages, not
  copied one API segment per block. The original language, embed, and notes are preserved.
- **Translate to English** is available in the Flashcard, Other Blocks, and Other
  Pages context menus. It automatically sends the prompt and translates editable
  prose in place, including descendants, while preserving structure, references,
  code, and metadata.
- **Fix Content** is available in the Flashcard, Other Blocks, and Other Pages context
  menus. It corrects typos, spelling, and clearly wrong grammar in place, including
  descendants. Slightly imperfect grammar and personal writing style are intentionally
  left alone.
- **Summarize Content** is available in the Flashcard, Other Blocks, and Other Pages
  context menus. It preserves the source and adds a `Summary` child subtree beneath
  a block, or a top-level `Summary` subtree on a page, covering the selected content
  and its descendants.
- **Evaluate Math** is available for blocks tagged `#Math` or containing LaTeX math.
  It preserves the expression and adds a `Result` child subtree, with optional
  step-by-step working beneath it.

Only Translate to English sends automatically. The other four leave the prompt in
the composer so you can adjust it before sending. Page commands work on page content,
not page names or definitions. Graph changes use the existing Review & Commit workflow.

The text commands (Translate to English, Fix Content, and Summarize Content) are
limited to the Flashcard, Other Blocks, and Other Pages context menus. They are not
offered for image, PDF, video, math, tag, property, or journal contexts.

Math blocks are detected from the `#Math` tag or inline/display LaTeX such as
`$x^2$` or `$$...$$`. A mathematical flashcard stays in the Flashcard category
because Flashcard takes precedence over Math.

These built-ins can be enabled or disabled in the Command Editor; their bundled
prompts and metadata are maintained by the plugin.

## Automatically send a command

Set `command-auto-send: true` in a command's YAML frontmatter to submit the composer
automatically after the command prepares its thread, attachments, and prompt text:

```markdown
---
name: Summarize selection
invoke-location:
  - Block Context Menu/Other Blocks
command-invoke-in-new-thread: true
command-auto-send: true
---
Summarize the attached block.
```

`command-auto-send` is optional and defaults to `false`. Omit it or set it to
`false` to leave the prepared message in the composer for review and manual sending.
The value must be a YAML boolean (`true` or `false`), not a quoted string. The
Command Editor provides key and boolean-value completion and validates the field.

This setting is independent of `command-invoke-in-new-thread`. With a same-thread
command, a nonempty prompt replaces the current draft text; an empty prompt leaves
the draft intact. Auto-send submits the resulting composer text and attachments,
including for attachment-only commands, subject to the composer's normal send
eligibility. An entirely empty composer is not sent.

Commands retain best-effort execution: preparation errors are logged and later
steps, including auto-send, are still attempted. Review this behavior before
enabling automatic submission for commands that depend on attachments.

Bundled commands support the same field. Built-in command metadata remains owned
by the plugin; this does not make it user-editable. Translate to English opts into
automatic sending; the other bundled commands do not.
