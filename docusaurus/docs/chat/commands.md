# Commands

Commands populate the AI chat composer from a Markdown prompt, optionally including
the block or page from which they were invoked as an attachment. Edit user commands
in the Command Editor.

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
by the plugin; this does not make it user-editable. Existing bundled commands do
not opt into automatic sending.
