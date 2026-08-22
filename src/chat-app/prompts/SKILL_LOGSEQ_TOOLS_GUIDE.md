---
name: Logseq Tools Guide
description: Use before marking changes in logseq with tools. Contains syntax information and guide to create query blocks, math, code etc
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: false
---

# Logseq Tools Guide

## Multi-Step and Parallel Execution

- Plan dependencies before calling tools. Independent tool calls should be parallelized; dependent calls must wait for their parent result.
- Tool calls are executed in the order you issue them, so create containers before children.
- For example, when creating a new page: create the page first, insert top-level blocks in parallel, then insert child blocks for each returned parent block in parallel. Repeat by depth.
- Prefer fewer batches with many independent calls over one serial call at a time.

## Uncommitted Changes and Commit

- Logseq write tools create applied uncommitted changes. Call the commit tool only after the whole task is complete so the user can review and commit or discard the uncommitted changes.
- The commit tool shows the diff and lets the user create committed changes or discard uncommitted changes.
- Reversion can retain commands as not applied uncommitted changes. If the state becomes unsafe, discard it and rebuild from a clean state.

## Creating Pages / Inserting Blocks

- Normal Logseq block content supports Markdown including math, tables, block refs, page refs, tasks, queries, and cards.
- Show page/block embeds using `[[<page or block uuid>]]` syntax in Markdown.
- Logseq is an outliner. When creating pages, break larger concepts into sub-points unless the user specifies a different format.
- For special blocks, properties, tags, tasks, code, math, queries, and cards, use the Logseq Properties and Tags skill.
- Invoking create page tool with name in `Aug 22nd, 2026` format creates the corresponding journal page.

## Creating Query Blocks in DB Graphs

Query blocks are created from a single visible block plus an internal query-value block that Logseq manages automatically.

To create a query block with tools:

1. Create or update the visible block with the desired title.
2. Add the `#Query` tag/class to the visible block.
3. Set the visible block's `logseq.property/query` property to the query text. Advanced queries work directly when the query text is wrapped in a `{:query ...}` map.

Use these query text shapes:

```clojure
;; Simple query DSL
(tags foo)
```

```clojure
;; True Datalog advanced query map (works directly via logseq.property/query)
{:query [:find (pull ?b [:block/uuid :block/title])
         :where
         [?b :block/tags ?task-tag]
         [?task-tag :block/title "Task"]]}
```

Do not put the query EDN in the visible block content unless the user wants it shown as the title.

### Gotchas
- Avoid simple DSL queries since you cannot test them.
- When creating advanced query, the namespace of query property should be logseq.property.

## Limitations

- You cannot create or upload PDF/image files, but you may edit PDF highlight pages.
- Deleted pages go to the recycle bin, not permanent deletion.
- You cannot extend a tag from another tag.
- You cannot insert node embed, also known as block embed.
