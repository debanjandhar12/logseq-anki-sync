---
id: selectively-disable-sync
title: Selectively Disable Sync
description: Control which blocks should not sync to Anki
---

import LogseqExample from '@site/src/components/LogseqExample';

# Selectively Disable Sync

## Disabling Sync with Properties

Use the `disable-anki-sync` property to prevent cards from syncing to Anki:

<LogseqExample>

- disable-anki-sync:: true
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

When there is no `disable-anki-sync` property in current block, parent block, page properties, or namespace page properties, then card syncs normally.

## Property Specificity Rules

The plugin follows a specificity hierarchy when determining if sync is disabled. Properties closer to the card block take priority:

### 1. Block-Level Properties (Highest Priority)

<LogseqExample>

- disable-anki-sync:: true
  What is the capital of Japan? #card
  - Tokyo

</LogseqExample>

The card will not sync.

### 2. Parent Block-Level Properties

<LogseqExample>

- disable-anki-sync:: true
  Geography Questions
  - What is the capital of Japan? #card
    - Tokyo

</LogseqExample>

The card will not sync.

### 3. Page Properties

Properties defined in the first block of a page apply to all cards on that page:

<LogseqExample>

**Draft Questions Page**

- disable-anki-sync:: true
- What is the capital of Japan? #card
  - Tokyo
- disable-anki-sync:: false
  What is the capital of France? #card
  - Paris

</LogseqExample>

Japan capital card will not sync (as defined in page properties) and France capital card will sync (overridden by current block property).

### 4. Page Namespace Fallback

If no `disable-anki-sync` property is found in current block, parent block, or page property, the plugin uses the page's namespace:

- Page `Draft/Geography` → Checks `Draft` page for `disable-anki-sync` property
- Page `Draft/Geography/Capitals` → Checks `Draft/Geography` page, then `Draft` page

## Tips

- Use page properties (first block) to disable sync for all cards on a page
- Use namespace pages (e.g., `Draft` page) to disable sync for entire sections of your graph
- Set `disable-anki-sync:: false` on specific blocks to re-enable sync when a parent has disabled it
