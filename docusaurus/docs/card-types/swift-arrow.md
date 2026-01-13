---
id: swift-arrow
title: Swift Arrow Cards
description: Quick directional cards with minimal syntax
discussion: "91"
---

import LogseqExample from '@site/src/components/LogseqExample';

Swift Arrow cards are designed to quickly capturing relationships or descriptions.

## Syntax

Use arrows in child blocks to create cards:

- `:->` — forward (front → back)
- `:<-` — reverse (back → front)
- `:<->` — bidirectional (both directions)

<LogseqExample>

- Tuberculosis
  - Description :-> It is a potentially serious infectious disease that mainly affects the lungs.
  - Symptoms :-> pain in the chest, chronic cough, fatigue, fever, loss of appetite

</LogseqExample>

This creates multiple cards, one for each child block:

| Front | Back |
| --- | --- |
| ![Swift card front 1](/img/swift-arrow-front-1.png) | ![Swift card back 1](/img/swift-arrow-back-1.png) |
| ![Swift card front 2](/img/swift-arrow-front-2.png) | ![Swift card back 2](/img/swift-arrow-back-2.png) |

## Tips

- Use `extra::` to provide mnemonics (see [Extra Details & Hints](../usage/extra-details-hints)).
