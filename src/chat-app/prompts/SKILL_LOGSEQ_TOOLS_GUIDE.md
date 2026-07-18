---
name: Logseq Tools Guide
description: Use before marking changes in logseq with tools. Contains syntax information of logseq markdown.
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

## Limitations

- You cannot create or upload PDF/image files, but you may edit PDF highlight pages.
- You cannot create, delete, or rename journal pages, but you may edit their content.
- Deleted pages go to the recycle bin, not permanent deletion.
- You cannot extend a tag from another tag.
- You cannot insert node embed, also known as block embed.
