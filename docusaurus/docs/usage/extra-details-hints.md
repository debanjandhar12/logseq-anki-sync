---
id: extra-details-hints
title: Extra Details & Hints
description: Add explanations and hints to cards
discussion: "92"
---

import LogseqExample from '@site/src/components/LogseqExample';

Add supporting information to your flashcards using hints and extra details.

## Hints

It is possible to add hints to the front side of cloze cards using this syntax:

<LogseqExample>

- {{c1 Tokyo::what city?}} is the capital of Japan.

</LogseqExample>

This produces the following card:

| Front | Back |
| --- | --- |
| ![Hint front](/img/hint-front.png) | ![Hint back](/img/hint-back.png) |

Hints can also be added to Highlight Note and Occlusion Note through the GUI.

## Extra Details

Use `extra::` property to add explanations that appear on the back of cards:

<LogseqExample>

- extra:: Mnemonics: \*\*Na\*\*tive \*\*M\*\*a\*\*g\*\*pies \*\*Al\*\*ways \*\*Si\*\*t \*\*P\*\*eacefully \*\*S\*\*earching \*\*Cl\*\*ear \*\*Ar\*\*eas
  Periodic Table - Period 3 :-&gt;
  Na Mg Al Si P S Cl Ar

</LogseqExample>

This produces the following card:

| Front | Back |
| --- | --- |
| ![Extra card front](/img/extra-details-front.png) | ![Extra card back](/img/extra-details-back.png) |

The above property is supported by all card types.

For ID-specific extra details, use `{{c1 clozed_text::hint::extra}}`:

<LogseqExample>

- {{c1 Tokyo::what city?::Japan's capital}} is the capital of Japan.

</LogseqExample>

The extra appears as plain text on the back of the corresponding cloze card.

> Extra Details can also be added to Highlight Note and Occlusion Note through the GUI.
