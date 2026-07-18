---
name: Logseq Properties and Tags
description: Use when creating, reading, updating, or reasoning about Logseq DB graph properties, property schemas, tags/classes, inherited tag properties, special tags, or special properties.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Properties

Properties are DB entities. Think of them as a two-layer model:

1. **Property definitions (schema) [a.k.a. property pages]**
    - A property key such as `rating`, `authors`, or `zotero_key` exists as an entity.
    - It may define schema: type, cardinality, visibility, classes, and optional default value.
    - Discover the property schema/ident before setting or querying values. Display names are not stable DB idents.
2. **Property values (data)**
    - Blocks/pages store values for property keys as structural DB data.
    - Do not emit `key:: value` text to set a DB property unless the user explicitly wants Markdown text.
    - A property can have one value or many values depending on the property schema's cardinality.

# Logseq Tags

Tags are DB entities that behave like **classes**. Think of them as a two-layer model:

1. **Tag schema [a.k.a. tag page]**
    - Defines properties that are auto-inherited by blocks tagged with it.
    - Each tagged block can define the inherited property values independently.
    - Tags provide the property schema, not per-block property values.
    - Tags can extend other tags.
2. **Tagged blocks**
    - Blocks tagged by the tag through actual DB tags/classes.
    - Do not assume a `#tag` string in block text equals a DB tag. Use tag tools or `:block/tags` queries for actual tagged blocks.

# Special Tags and Properties

Several special tags change the visual look or behavior of a normal block:

- `#Code` converts the block to a code block.
- `#Math` converts block content to a math block. For example, `x^2` renders as a math expression. Alternatively, use markdown math syntax. However, do not use markdown $$ syntax together with math tag.
- `#Task` converts the block to a task. Change `logseq.property/status` to values such as `Todo`, `Backlog`, `Canceled`, `Doing`, `Done` or empty string (default: empty string).
- `#Query` converts the block to a query block. The visible block content is the query title; the visible block's `logseq.property/query` points to a separate query-value block whose content/title stores the query text.

Several special properties change rendering or behavior:

- `logseq.property/background-color` changes block background color.
- `logseq.property/order-list-type` set to `number` makes bullets appear as numbers.

# Other Special Tags

- All property pages are tagged with `#Property` / `:logseq.class/Property`.
- All tags are tagged with `#Tag` / `:logseq.class/Tag`.
- All journal pages are tagged with `#Journal` / `:logseq.class/Journal`.

For low-level query shapes, use the Logseq Datascript Query skill instead of repeating query logic here.

# Gotchas

- Do not write `(tags ...)` as if it were Datalog / Datascript. 
- When storing a Datalog query in a query block, the stored query must be self-contained unless Logseq query-block inputs are also configured. Do not directly copy `LogseqDataScriptQueryTool` examples that use `:in $ ?value` plus a separate `inputs` array into a query block; rewrite constants into the stored query or use a built-in ident such as `:logseq.class/Math-block`.
