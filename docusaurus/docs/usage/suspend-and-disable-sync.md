---
id: suspend-and-disable-sync
title: Suspending & Disabling Sync
description: Control which cards should be suspended or not synced to Anki
---

import LogseqExample from '@site/src/components/LogseqExample';

# Suspending & Disabling Sync

There are two properties to control what appears in your anki queue: `suspend-anki-card` (recommended) and `disable-anki-sync`.

## Suspending Cards (Recommended)

Use the `suspend-anki-card` property to suspend cards in Anki instead of completely removing them. This is the **recommended approach** when you want to temporarily hide cards from review without losing your progress or deleting the cards.

:::info
For `suspend-anki-card` to work, you must have **"Suspended"** enabled in your plugin settings under **"Overwrite following on every sync"**.
:::

<LogseqExample>

- suspend-anki-card:: true
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

### Suspend Property Specificity Rules

The plugin follows a specificity hierarchy when determining if a card should be suspended. Properties closer to the card block take priority:

#### 1. Block-Level Properties (Highest Priority)

<LogseqExample>

- suspend-anki-card:: true
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

The card will be suspended.

#### 2. Parent Block-Level Properties

<LogseqExample>

- suspend-anki-card:: true
  Geography Questions
  - What is the capital of Japan? #card
    - Tokyo

</LogseqExample>

The card will be suspended.

#### 3. Page Properties

Properties defined in the first block of a page apply to all cards on that page:

<LogseqExample>

**Draft Questions Page**

- suspend-anki-card:: true
- What is the capital of Japan? #card
  - Tokyo
- suspend-anki-card:: false
  What is the capital of France? #card
  - Paris

</LogseqExample>

Japan capital card will be suspended (as defined in page properties) and France capital card will not be suspended (overridden by current block property).

#### 4. Page Namespace Fallback

If no `suspend-anki-card` property is found in current block, parent block, or page property, the plugin uses the page's namespace:

- Page `Draft/Geography` → Checks `Draft` page for `suspend-anki-card` property
- Page `Draft/Geography/Capitals` → Checks `Draft/Geography` page, then `Draft` page

---

## Disabling Sync Completely

Use the `disable-anki-sync` property to **completely prevent cards from syncing** to Anki. 

:::warning
**Important difference**: Unlike `suspend-anki-card`, using `disable-anki-sync` will:
- Prevent the card from being created in Anki
- **Delete existing cards from Anki** if they were already synced
- Lose all review progress for that card

Only use this if you want to permanently remove cards from Anki.
:::

<LogseqExample>

- disable-anki-sync:: true
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

### Disable Sync Property Specificity Rules

The `disable-anki-sync` property follows the same hierarchy as `suspend-anki-card`:

1. **Block-Level Properties** (Highest Priority)
2. **Parent Block-Level Properties**
3. **Page Properties**
4. **Page Namespace Fallback**

<LogseqExample>

- disable-anki-sync:: true
  Geography Questions
  - What is the capital of Japan? #card
    - Tokyo

</LogseqExample>

The card will not sync and will be deleted from Anki if it already exists.

## Tips

- **Use `suspend-anki-card`** for temporarily hiding cards (e.g., draft questions, seasonal topics, cards you want to revisit later)
- **Use `disable-anki-sync`** only when you want to permanently exclude cards from Anki
- Use page properties (first block) to apply either property to all cards on a page
- Use namespace pages (e.g., `Draft` page) to control entire sections of your graph
- Set the property to `false` on specific blocks to override parent settings
- When `suspend-anki-card` is not set, the plugin will not modify the card's suspension status in Anki. It will remain as it is in Anki.
