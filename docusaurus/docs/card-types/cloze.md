---
id: cloze
title: Cloze Cards
description: Mask parts of your notes with cloze deletions.
sidebar_position: 3
---

import LogseqExample from '@site/src/components/LogseqExample';

Cloze cards allow you to hide parts of a sentence or block to test your recall. Logseq Anki Sync supports multiple ways of creating clozes so you can pick the workflow that suits your notes.

## Anki cloze macro syntax

This is the recommended approach because it maps directly to Anki's native cloze syntax and gives you full control over card numbers.

<LogseqExample>

- {{c2 Japan}} is the capital of {{c1 Japan}} (aka {{c1 Nipon}}).

</LogseqExample>

| Front | Back |
| --- | --- |
| ![Cloze card front 1](/img/cloze-anki-front-1.png) | ![Cloze card back 1](/img/cloze-anki-back-1.png) |
| ![Cloze card front 2](/img/cloze-anki-front-2.png) | ![Cloze card back 2](/img/cloze-anki-back-2.png) |

Use digits `1-9` to group clozes into cards (`c1`, `c2`, etc.).

## Logseq cloze macro syntax

Logseq's original cloze syntax is still supported for backwards compatibility.

<LogseqExample>

- Tokyo is the capital of {{cloze Japan}} (aka {{cloze Nipon}}).

</LogseqExample>

This produces separate cards for each clozed value but does not allow specifying card numbers, so multiple clozes cannot be grouped onto the same card.

| Front | Back |
| --- | --- |
| ![Logseq cloze front 1](/img/cloze-logseq-front-1.png) | ![Logseq cloze back 1](/img/cloze-logseq-back-1.png) |
| ![Logseq cloze front 2](/img/cloze-logseq-front-2.png) | ![Logseq cloze back 2](/img/cloze-logseq-back-2.png) |

## ORG CLOZE block syntax

Use ORG cloze blocks when you want to hide multiple lines together, such as math formulas or full paragraphs.

<LogseqExample>

- The Pythagorean theorem is
  #+BEGIN_CLOZE
  $$c=\sqrt{ a^{2}+b^{2} }$$
  #+END_CLOZE

</LogseqExample>

| Front | Back |
| --- | --- |
| ![ORG cloze front](/img/cloze-org-front.png) | ![ORG cloze back](/img/cloze-org-back.png) |

## `replaceCloze` syntax

`replaceCloze` lets you use search-and-replace patterns so you can cloze inside code blocks or math expressions.

<LogseqExample>

- replacecloze:: " 'a^{2}+b^{2}', /(c\^2|c )/gi "
  The Pythagorean theorem is
  $$c =\sqrt{ a^{2}+b^{2} }$$
  $$c^2= a^{2}+b^{2}$$

</LogseqExample>

| Front | Back |
| --- | --- |
| ![replaceCloze front 1](/img/cloze-replace-front-1.png) | ![replaceCloze back 1](/img/cloze-replace-back-1.png) |
| ![replaceCloze front 2](/img/cloze-replace-front-2.png) | ![replaceCloze back 2](/img/cloze-replace-back-2.png) |

## Tips

- Combine cloze syntax with `extra::` blocks to offer hints or mnemonics.
- Use deck properties (`deck::`) or page properties to route cloze notes to the right Anki deck.
