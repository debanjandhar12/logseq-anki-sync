---
id: extra-details-hints
title: Extra Details & Hints
description: Add explanations, mnemonics, and hints to your notes.
sidebar_position: 1
---

import LogseqExample from '@site/src/components/LogseqExample';

Logseq Anki Sync lets you enrich cards with additional explanations or hints using block properties or ORG macros.

## Extra details with block properties

Use the `extra::` property to append supporting text to the back of a card.

<LogseqExample>

- extra:: Mnemonics: \*\*Na\*\*tive \*\*M\*\*a\*\*g\*\*pies \*\*Al\*\*ways \*\*Si\*\*t \*\*P\*\*eacefully \*\*S\*\*earching \*\*Cl\*\*ear \*\*Ar\*\*eas
  Periodic Table - Period 3 :-&gt;
  Na Mg Al Si P S Cl Ar

</LogseqExample>

## Extra details with ORG blocks

<LogseqExample>

- Periodic Table - Period 3 :-&gt;
  Na Mg Al Si P S Cl Ar
  #+BEGIN_EXTRA
  Mnemonics: \*\*Na\*\*tive \*\*M\*\*a**g**pies \*\*Al\*\*ways \*\*Si\*\*t \*\*P\*\*eacefully \*\*S\*\*earching \*\*Cl\*\*ear \*\*Ar\*\*eas
  #+END_EXTRA

</LogseqExample>

Both approaches produce the same Anki card:

| Front | Back |
| --- | --- |
| ![Extra card front](/img/extra-details-front.png) | ![Extra card back](/img/extra-details-back.png) |

## Adding hints

Hints are not officially supported in Logseq Anki Sync yet, but you can mimic them by using Anki's cloze hint syntax.

<LogseqExample>

- {{c1 Tokyo::what city?}} is the capital of Japan.

</LogseqExample>

This renders a prompt showing the hint on the front of the card.

| Front | Back |
| --- | --- |
| ![Hint front](/img/hint-front.png) | ![Hint back](/img/hint-back.png) |
