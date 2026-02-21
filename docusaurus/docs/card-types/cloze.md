---
id: cloze
title: Cloze Cards
description: Hide parts of text to test recall
discussion: "89"
---

import LogseqExample from '@site/src/components/LogseqExample';

Cloze cards allow you to hide parts of a sentence or block to test your recall.

## Cloze Macro Syntax (Logseq Anki Sync Plugin style)

This is the recommended syntax. This uses numbering to give you full control over card grouping:

<LogseqExample>

- {{c2 Japan}} is the capital of {{c1 Japan}} (aka {{c1 Nipon}}).

</LogseqExample>

This produces two cards:

| Front | Back |
| --- | --- |
| ![Cloze card front 1](/img/cloze-anki-front-1.png) | ![Cloze card back 1](/img/cloze-anki-back-1.png) |
| ![Cloze card front 2](/img/cloze-anki-front-2.png) | ![Cloze card back 2](/img/cloze-anki-back-2.png) |

Use digits `1-9` to group clozes into cards (`c1`, `c2`, etc.).

## Original Logseq Cloze Macro Syntax

Logseq's original cloze syntax is also supported for backwards compatibility:

<LogseqExample>

- Tokyo is the capital of {{cloze Japan}} (aka {{cloze Nipon}}).

</LogseqExample>

This creates separate cards for each cloze but doesn't allow grouping multiple clozes onto one card.

| Front | Back |
| --- | --- |
| ![Logseq cloze front 1](/img/cloze-logseq-front-1.png) | ![Logseq cloze back 1](/img/cloze-logseq-back-1.png) |
| ![Logseq cloze front 2](/img/cloze-logseq-front-2.png) | ![Logseq cloze back 2](/img/cloze-logseq-back-2.png) |

## `replaceCloze` Syntax

The `replaceCloze` block property lets you use search-and-replace patterns so you can create cloze inside code blocks or math expressions.

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

:::warning
The replacecloze property is a file graph only feature. It is not available in db graphs. Instead, please use highlight mask feature (db graph only) for creating cloze inside code blocks or math expressions.
:::

## Tips

- Combine cloze syntax with `extra::` blocks to provide mnemonics.