---
id: hide-all-test-one
title: Hide All Test One
description: Hide clozes that are not being tested for incremental learning
---

import LogseqExample from '@site/src/components/LogseqExample';
import GifPlayer from '@site/src/components/GifPlayer';

# Hide All Test One

The `#hide-all-test-one` tag is designed for incremental learning scenarios where you want to test one item at a time while keeping others hidden. When applied to a card, it hides all clozes except the one currently being tested.

## Supported Card Types

This tag works with the following card types:

- **Multiline cards** - Hide other list items while testing one
- **Cloze cards** - Hide other cloze deletions while testing one
- **Image occlusion** - Hide other occlusion boxes while testing one

## Multiline Card Example

<LogseqExample>

- Fav Fruits?: #card #incremental #hide-all-test-one
  - Orange
  - Apple
  - Pizza

</LogseqExample>

When reviewing this card in Anki, only one item will be shown at a time, and the others will be hidden:

<GifPlayer gif="/img/hide-all-test-one-multiline.gif" alt="Hide All Test One Demo" caption="Only the current item being tested is visible, others are hidden" />

## Tips

- Use this tag when you want to prevent other items from giving away answers
