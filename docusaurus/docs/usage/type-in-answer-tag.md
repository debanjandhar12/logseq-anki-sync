---
id: type-in-answer-tag
title: Type-In Answer Tag
description: Test recall by typing your answer
---

import LogseqExample from '@site/src/components/LogseqExample';

# Type-In Tag

Add the `#type-in` tag to present a text box for typing your answer, enabling active recall practice.

## Basic Usage

<LogseqExample>

- The capital of japan is {{c1 Tokyo}}. #type-in

</LogseqExample>

This produces a card with a text input field where you type your answer before revealing it:

| Front | Back |
| --- | --- |
| ![Type-in front](/img/type-in-front.png) | ![Type-in back](/img/type-in-back.png) |

## Works With most card types

The `#type-in` tag works with multiline, cloze, and swift arrow cards:

<LogseqExample>

- What is the capital of Japan? #card #type-in
  - Tokyo

</LogseqExample>

## Tips

- Type-in strengthens active recall compared to passive recognition
- Works best with short, specific answers
- Anki shows your typed answer compared to the correct answer
