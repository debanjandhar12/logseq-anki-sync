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
| ![Cloze card front 1](https://user-images.githubusercontent.com/49021233/182571281-579c0c00-126c-4737-ac4f-d5671a16f59a.png) | ![Cloze card back 1](https://user-images.githubusercontent.com/49021233/182571309-752030ad-4b7f-4520-b9f9-68dd6256bcd8.png) |
| ![Cloze card front 2](https://user-images.githubusercontent.com/49021233/182571483-b63d019a-0395-4578-968d-3b8376ef3d64.png) | ![Cloze card back 2](https://user-images.githubusercontent.com/49021233/182571510-05b39c26-d3b1-4153-99f6-1efe28cbdc28.png) |

Use digits `1-9` to group clozes into cards (`c1`, `c2`, etc.).

## Logseq cloze macro syntax

Logseq's original cloze syntax is still supported for backwards compatibility.

<LogseqExample>

- Tokyo is the capital of {{cloze Japan}} (aka {{cloze Nipon}}).

</LogseqExample>

This produces separate cards for each clozed value but does not allow specifying card numbers, so multiple clozes cannot be grouped onto the same card.

| Front | Back |
| --- | --- |
| ![Logseq cloze front 1](https://user-images.githubusercontent.com/49021233/182571968-4a4a8704-ebe1-4cc4-acf4-1277882a0be2.png) | ![Logseq cloze back 1](https://user-images.githubusercontent.com/49021233/182571983-5243c0b3-1a69-4455-86e0-7eefc11224e9.png) |
| ![Logseq cloze front 2](https://user-images.githubusercontent.com/49021233/182572014-78202e28-0c38-4555-aed7-d60d7fde7d34.png) | ![Logseq cloze back 2](https://user-images.githubusercontent.com/49021233/182572038-a3eceaa5-5fdd-4935-98c3-d410158f2d8c.png) |

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
| ![ORG cloze front](https://user-images.githubusercontent.com/49021233/182572363-2acd54f0-70eb-4d8f-89a6-9b59e5548452.png) | ![ORG cloze back](https://user-images.githubusercontent.com/49021233/182572381-0fdd1c65-175d-4a07-b728-ccea7884394e.png) |

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
| ![replaceCloze front 1](https://user-images.githubusercontent.com/49021233/182572636-2e050021-7f71-46ba-97d4-c24aa2ea8371.png) | ![replaceCloze back 1](https://user-images.githubusercontent.com/49021233/182572656-1506687f-06af-41fc-886f-7c5ca69cc991.png) |
| ![replaceCloze front 2](https://user-images.githubusercontent.com/49021233/182572684-429cd32b-96a5-431a-855a-f5921e843658.png) | ![replaceCloze back 2](https://user-images.githubusercontent.com/49021233/182572705-a38af007-20b9-45d9-8954-4465d9fc022a.png) |

## Tips

- Combine cloze syntax with `extra::` blocks to offer hints or mnemonics.
- Use deck properties (`deck::`) or page properties to route cloze notes to the right Anki deck.
