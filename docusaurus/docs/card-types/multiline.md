---
id: multiline
title: Multiline Cards
description: Create structured cards using tag-based syntax.
sidebar_position: 1
---

import LogseqExample from '@site/src/components/LogseqExample';

Multiline cards allow you to turn a parent block and its children into rich flashcards.

## Simple multiline card

The easiest way to make a multiline card is to add the `#card` tag to a block.

<LogseqExample>

- SQL commands can be divided into: #card
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

This produces a note that renders the parent on the front and the children on the back.

| Front | Back |
| --- | --- |
| ![Multiline front](/img/multiline-card-front.png) | ![Multiline back](/img/multiline-card-back.png) |

## Incremental multiline card

To generate a separate card for each child bullet, add the `#incremental` tag.

<LogseqExample>

- SQL commands can be divided into: #card #incremental
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

Each child becomes its own back side.

| Front | Back |
| --- | --- |
| ![Incremental card 1 front](/img/incremental-card-1-front.png) | ![Incremental card 1 back](/img/incremental-card-1-back.png) |
| ![Incremental card 2 front](/img/incremental-card-2-front.png) | ![Incremental card 2 back](/img/incremental-card-2-back.png) |
| ... | ... |

## Direction control

Use direction tags to customize the testing direction.

<LogseqExample>

- SQL commands can be divided into: #card #reversed
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

| Front | Back |
| --- | --- |
| ![Reversed card front](/img/reversed-card-front.png) | ![Reversed card back](/img/reversed-card-back.png) |

## Additional tips

- Use the `#flashcard` tag if you want Logseq to skip its native flashcard formatting.
- Use the `direction::` property with `->`, `<-`, or `<->` as an alternative to direction tags.
- Combine with `#depth-n` to limit recursion depth, or `#card-group` to convert all children to cards.
