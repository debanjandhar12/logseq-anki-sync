---
id: deck-tags
title: Specifying Deck & Tags
description: Control where cards are stored and how they're tagged
discussion: "117"
---

import LogseqExample from '@site/src/components/LogseqExample';

# Specifying Deck & Tags

## Setting Deck with Properties

Use the `deck` property to specify where cards should be stored:

<LogseqExample>

- deck:: [[Japanese Geography]]
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

When there is no deck property in the current block, parent block, page properties, or namespace page properties, the card is created in a deck named after the current page name.

## Property Specificity Rules

The plugin follows a specificity hierarchy when determining deck placement. Properties closer to the card block take priority:

### 1. Block-Level Properties (Highest Priority)

<LogseqExample>

- deck:: [[Japanese Geography]]
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

The card goes to the `Japanese Geography` deck.

### 2. Parent Block-Level Properties

<LogseqExample>

- deck:: [[World Geography]] 
  Capitals
  - What is the capital of Japan? #card
    - Tokyo

</LogseqExample>

The card goes to the `World Geography` deck.

### 3. Page Properties

Properties defined in the first block of a page apply to all cards on that page:

<LogseqExample>

**Geography Study Page**

- deck:: [[World Geography]]
- What is the capital of Japan? #card
  - Tokyo
- deck:: [[France Geography]]
  What is the capital of France? #card  
  - Paris

</LogseqExample>

The Japan capital card goes to the `World Geography` deck (as defined in page properties) and the France capital card one goes to the `France Geography` deck (overridden by the current block property).

### 4. Namespace Properties

If no deck property is found in the current block, parent block, or page properties, the plugin will look for a `deck` property in the namespace pages.

### 5. Current Page Name (Default)

If no deck property is found anywhere, the deck is named after the current page.

- Page `Tutorial/Getting Started` → `Tutorial::Getting Started` deck
- Page `Getting Started` (no namespace) → `Getting Started` deck

## Setting Tags with Properties

Use the `tags` property to add tags to your Anki cards. Unlike deck properties, tags are comma-separated values that join together from all levels:

<LogseqExample>

- tags:: geography, capitals
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

### Tags Inheritance and Joining

Tags from different levels are combined rather than overridden:

<LogseqExample>

**Geography Study Page**

- tags:: study, geography
- tags:: world, capitals
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

The card will have all tags: `study`, `geography`, `world`, `capitals`, `card`.

## Tips

- Use page references for deck values (e.g., `deck:: [[My Deck]]`). This makes renaming easier - just rename the page.
- Page properties (first block) are inherited by all cards on the page unless overridden by block-level properties.