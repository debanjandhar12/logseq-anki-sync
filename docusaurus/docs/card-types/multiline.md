---
id: multiline
title: Multiline Cards
description: Create structured cards using tag-based syntax
discussion: "88"
---

import LogseqExample from '@site/src/components/LogseqExample';

Multiline cards allow you to include a list of blocks on the back of a card with parent block acting as the question.

## Basic Multiline Card

The easiest way to make a multiline card is to add the `#card` tag to a block:

<LogseqExample>

- SQL commands can be divided into: #card
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

This produces card with front side showing question and back side showing the children blocks.

| Front | Back |
| --- | --- |
| ![Multiline front](/img/multiline-card-front.png) | ![Multiline back](/img/multiline-card-back.png) |

## Incremental Cards

A multiline card can be marked as incremental by adding `#incremental` to multiline card block:

<LogseqExample>

- SQL commands can be divided into: #card #incremental
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

This will make the plugin create separate cards for each of the children blocks:

| Front | Back |
| --- | --- |
| ![Incremental card 1 front](/img/incremental-card-1-front.png) | ![Incremental card 1 back](/img/incremental-card-1-back.png) |
| ![Incremental card 2 front](/img/incremental-card-2-front.png) | ![Incremental card 2 back](/img/incremental-card-2-back.png) |
| ... | ... |

## Card Direction

Testing direction of multiline cards can be controlled using direction tags: `#forward`, `#reversed`, `#bidirectional`.

For example, when adding `#reversed` tag in a multiline card block, you'll see all the child blocks and be asked remember the parent block.

<LogseqExample>

- SQL commands can be divided into: #card #reversed
  - Data Definition Language
  - Data Manipulation Language
  - Data Control Language

</LogseqExample>

| Front | Back |
| --- | --- |
| ![Reversed card front](/img/reversed-card-front.png) | ![Reversed card back](/img/reversed-card-back.png) |

## Tips

- Use `#flashcard` to skip Logseq's native flashcard formatting
- Use `direction::` property with `->`, `<-`, or `<->` as an alternative to tags
- Combine with `#depth-n` to limit child block depth
- Add `extra::` for mnemonics (see [Extra Details & Hints](../usage/extra-details-hints))