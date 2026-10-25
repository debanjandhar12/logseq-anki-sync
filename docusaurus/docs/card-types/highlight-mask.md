---
id: highlight-mask
title: Highlight Mask Cards
description: Create cloze cards by highlighting text regions
discussion: "0"
---

Highlight Mask creates cloze cards by allowing you to select and highlight specific text regions within a block.
Unlike clozes, this allows you to create masks inside code blocks or math expressions.

:::note
Highlight Mask is only available in **DB graphs**. File-based graphs do not support this feature.
:::

## Creating Cards

Use the slash command `/Highlight Mask` or right-click a block and select "Highlight Mask" to open the editor:

1. Select text in the editor to highlight
2. Click "Add Highlight" to create a cloze
3. Assign a cloze ID (1-9) to group clozes into cards
4. Optionally add hints
5. Click "Save"

<GifPlayer gif="/logseq-anki-sync/img/highlight_note_demo.gif" alt="Highlight Mask Demo"  />

## FAQ

<details>
  <summary>Where is highlight data stored?</summary>
  <div>In the <code>highlight_mask</code> block property. Deleting this property removes the card.</div>
</details>

## Tips

-   Use `extra::` to add mnemonics or additional context
