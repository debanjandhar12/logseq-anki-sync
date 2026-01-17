---
id: hiding-parent-blocks
title: Hiding Parent Blocks
description: Control visibility of parent blocks in cards
---

import LogseqExample from '@site/src/components/LogseqExample';

# Hiding Parent Blocks

When creating cards, parent blocks are shown on the front side for context. Use these tags to control their visibility.

## Hide Specific Parent Block

Use `#hide-when-card-parent` on a parent block to hide it from the front side of cards:

<LogseqExample>

- Chapter 1: Introduction #hide-when-card-parent
  - What is the capital of Japan? #card
    - Tokyo

</LogseqExample>

The "Chapter 1: Introduction" block will not appear on the card's front side.

## Hide All Parent Blocks

Use `#hide-all-card-parent` on a card to hide all its parent blocks from the front side:

<LogseqExample>

- Geography
  - Asia
    - What is the capital of Japan? #card #hide-all-card-parent
      - Tokyo

</LogseqExample>

Both "Geography" and "Asia" parent blocks will not appear on the card's front side.

## Comparison

| Tag | Applied To | Effect |
| --- | --- | --- |
| `#hide-when-card-parent` | Parent block | Hides that specific parent block from all child cards |
| `#hide-all-card-parent` | Card block | Hides all parent blocks from that specific card |

## Tips

- Use `#hide-when-card-parent` when organizing cards under headings you don't want shown
- Use `#hide-all-card-parent` when parent context isn't needed for specific cards
- Parent blocks still provide organizational structure in Logseq even when hidden in Anki
