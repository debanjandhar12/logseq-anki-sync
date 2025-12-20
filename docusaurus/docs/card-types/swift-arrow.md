---
id: swift-arrow
title: Swift Arrow Cards
description: Author directional cards with minimal syntax.
sidebar_position: 2
---

import LogseqExample from '@site/src/components/LogseqExample';

Swift Arrow cards are designed for quickly capturing relationships or descriptions. They are easiest to set up when the plugin setting `includeParentContent` is enabled (`Logseq → Settings → Plugin Settings → Logseq Anki Sync`).

## Syntax

You can create Swift cards by adding arrow markers at the end of lines:

- `:->` — forward card (front → back)
- `:<-` — reverse card (back → front)
- `:<->` — bidirectional card (both directions)

<LogseqExample>

- Tuberculosis
  - Description :-> It is a potentially serious infectious disease that mainly affects the lungs.
  - Symptoms :-> pain in the chest, chronic cough, fatigue, fever, loss of appetite

</LogseqExample>

This block generates a note with multiple cards, one for each child bullet.

| Front | Back |
| --- | --- |
| ![Swift card front 1](/img/swift-arrow-front-1.png) | ![Swift card back 1](/img/swift-arrow-back-1.png) |
| ![Swift card front 2](/img/swift-arrow-front-2.png) | ![Swift card back 2](/img/swift-arrow-back-2.png) |

## Tips

- Combine Swift syntax with properties like `deck::` or `tags::` to route cards to specific decks.
- Use `extra::` to provide additional hints or mnemonics (see [Extra Details & Hints](../usage/extra-details-hints)).
