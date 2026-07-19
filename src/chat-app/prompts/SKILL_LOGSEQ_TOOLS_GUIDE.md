---
name: Logseq Tools Guide
description: Use before marking changes in logseq with tools. Contains syntax information and guide to create query blocks, math, code etc
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Tools Guide

## Multi-Step and Parallel Execution

- Plan dependencies before calling tools. Independent tool calls should be parallelized; dependent calls must wait for their parent result.
- Tool calls are executed in the order you issue them, so create containers before children.
- For example, when creating a new page: create the page first, insert top-level blocks in parallel, then insert child blocks for each returned parent block in parallel. Repeat by depth.
- Prefer fewer batches with many independent calls over one serial call at a time.

## Commit and Rollback

- Logseq write tools stage temporary changes. Call the commit tool only after the whole task is complete.
- The commit tool shows the diff and asks the user to approve or reject permanent changes.
- If the staged state becomes extremely messy, rollback and rebuild from a clean state.

## Creating Pages / Inserting Blocks

- Normal Logseq block content supports Markdown including math, tables, block refs, page refs, tasks, queries, and cards.
- Show page/block embeds using `[[<page or block uuid>]]` syntax in Markdown.
- Logseq is an outliner. When creating pages, break larger concepts into sub-points unless the user specifies a different format.
- For special blocks, properties, tags, tasks, code, math, queries, and cards, use the Logseq Properties and Tags skill.

## Creating Query Blocks in DB Graphs

Logseq DB graph query blocks use two block entities:

1. **Visible query block**
    - Has the `#Query` class/tag (`:logseq.class/Query`).
    - Uses its normal block content/title as the visible query title.
    - Has a `logseq.property/query` property that points to a separate query-value block.
2. **Query-value block**
    - Stores the actual query text in its own block content/title.
    - Is a property-value block created from `logseq.property/query`.
    - Has `logseq.property/created-from-property = logseq.property/query` internally.
    - Does **not** have its own `logseq.property/query` property.

To create a query block with tools:

1. Create or update the visible block with the desired title.
2. Add the `#Query` tag/class to the visible block.
3. Set the visible block's `logseq.property/query` property to the query text. This creates or updates the query-value block.
4. Read the visible block and locate the returned `logseq.property/query` value block when you need to edit query metadata directly.
5. For an advanced query, add the `#Code` tag on the query-value block (not the visible block) before putting the query.
6. For advanced query, do not forget to put the query inside {:query } map in query-value block.

[Note: Try to avoid simple DSL queries since you cannot test them.]

Use these query text shapes:

```clojure
;; Simple query DSL stored in the query-value block title
(tags foo)
```

```clojure
;; True Datalog advanced query map
{:query [:find (pull ?b [:block/uuid :block/title])
         :where
         [?b :block/tags ?task-tag]
         [?task-tag :block/title "Task"]]}
```

Do not put the query EDN in the visible block content unless the user wants it shown as the title. Do not expect the query-value block to contain `logseq.property/query`; it is itself the value of that property.

## Limitations

- You cannot create or upload PDF/image files, but you may edit PDF highlight pages.
- You cannot create, delete, or rename journal pages, but you may edit their content.
- Deleted pages go to the recycle bin, not permanent deletion.
- You cannot extend a tag from another tag.
- You cannot insert node embed, also known as block embed.
