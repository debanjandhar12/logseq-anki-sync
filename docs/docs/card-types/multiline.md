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
| ![Multiline front](https://user-images.githubusercontent.com/49021233/182570224-934ca5db-0e4b-4afc-b024-eab22b04dd3f.png) | ![Multiline back](https://user-images.githubusercontent.com/49021233/182570284-4d1ecef2-0684-42f6-8678-2e19207e8584.png) |

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
| ![Incremental card 1 front](https://user-images.githubusercontent.com/49021233/182570538-bd0dc5f1-2c20-428c-abc5-fbf27f8accae.png) | ![Incremental card 1 back](https://user-images.githubusercontent.com/49021233/182570569-5c5f25b5-77ba-4caf-96bf-9a731cc85110.png) |
| ![Incremental card 2 front](https://user-images.githubusercontent.com/49021233/182570591-4b11c908-0319-4ecf-b6ac-20aa6daede65.png) | ![Incremental card 2 back](https://user-images.githubusercontent.com/49021233/182570623-b16f6ad2-3ab2-40a0-981a-89fb3fcf655b.png) |
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
| ![Reversed card front](https://user-images.githubusercontent.com/49021233/182570958-e5904212-ddc2-4923-b69f-3860489a2ac0.png) | ![Reversed card back](https://user-images.githubusercontent.com/49021233/182570983-6cd505cd-8e9a-4918-9818-e9374096a71c.png) |

## Additional tips

- Use the `#flashcard` tag if you want Logseq to skip its native flashcard formatting.
- Use the `direction::` property with `->`, `<-`, or `<->` as an alternative to direction tags.
- Combine with `#depth-n` to limit recursion depth, or `#card-group` to convert all children to cards.
