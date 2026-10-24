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

<details>
  <summary>How can I hide the highlight mask data property?</summary>
  <div>
    Enable <strong>Hide Highlight Mask Data</strong> in the plugin's addon settings.
    The addon hides the raw <code>highlight_mask</code> value while preserving its native label and other properties.
    On supported DB hosts, it shows <code>&lt;hidden highlight mask data with N cards&gt;</code> and an <strong>Edit</strong> link that opens the Highlight Mask editor.
    The count is the number of distinct positive cloze IDs in the stored highlights, not the number of highlighted regions, and refreshes after editing.
    If the count cannot be resolved, the summary omits it. Hosts without compatible property-renderer support show only <code>&lt;hidden highlight mask data&gt;</code>; use the slash command or block context menu to edit instead.
  </div>
</details>

## Tips

-   Use `extra::` to add mnemonics or additional context
