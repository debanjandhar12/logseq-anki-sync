---
name: Logseq Datascript Query
description: Use this skill whenever the user asks for Logseq DB graph Datascript, Datalog, advanced DB queries, task queries, date queries, property queries, tag/class queries, or LogseqDataScriptQueryTool usage.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datascript Query Skill

## Objective

Write reliable Logseq DB graph Datascript queries for `LogseqDataScriptQueryTool`. Prefer the tested query text printed in this skill over inventing new query shapes.

This skill is only for DB graphs. File graph syntax is included only as migration context and must not be used for new queries.

## Context & Rules

- Use `LogseqDataScriptQueryTool` for raw Datascript/Datalog queries.
- Pass the query as `datalogString`.
- Pass each `:in` value through the tool `inputs` array. The tool executes the query for you; do not try to call Logseq APIs directly.
- Treat every item in `inputs` as an EDN string that Logseq reads before executing the query.
- Never hardcode user-specific page names, property idents, date ranges, search terms, or tag names when an input parameter can express them.
- Never use Logseq file graph attributes in DB graph queries. Use `:block/title` instead of `:block/content`, and use DB property/tag attributes instead of `:block/properties`, `:block/marker`, `:block/priority`, `:block/scheduled`, or `:block/deadline`.
- Never assume a property ident. Discover it first with the property-schema query printed below, `Editor.getProperty`, or an existing property entity returned by Logseq.
- Never assume a property value type. Inspect `:logseq.property/type` before choosing string, number, boolean, ref/node, date, or datetime query clauses.
- Use lowercase values with `:block/name`. Use `:block/title` for display casing.
- Use regex for case-insensitive text search. Put `(?i)` in the regex string input, not in a hardcoded clause.
- Use `or-join` and `not-join` when branches do not bind the same local variables.
- Prefer narrow pull patterns such as `[:block/uuid :block/title]`; avoid `(pull ?b [*])` unless the user explicitly needs full entity data.
- If a query fails or returns no rows, debug by reducing it to a smaller tested fixture before adding complexity.

## What is an `:db/ident`?

An ident is a `:db/ident` keyword — the unique, stable name for an entity in a DB graph. Every property, tag/class, and built-in schema attribute has one. It behaves like a primary key: renaming a page's `:block/title` does not change its ident, so idents are the reliable way to reference built-in entities across queries and graphs.

Most idents are namespaced keywords:

- Built-in classes: `:logseq.class/Task`, `:logseq.class/Property`, `:logseq.class/Query`.
- Built-in properties: `:logseq.property/priority`, `:logseq.property/scheduled`.
- User-created properties: `:user.property/<key>-<id>`, e.g. `:user.property/rating-abc123`.
- Core attributes: `:db/ident`, `:block/title`, `:block/uuid`, `:block/name`, `:block/tags`.

A few built-in properties use un-namespaced idents — the graph returns them without a `:logseq.property/*` namespace (observed in this graph: the `tags` and `alias` properties). When a query must reference one of these by ident, use the bare keyword the graph returns instead of inventing a namespace for it.

Use idents — not display titles — for stable references to built-in classes and properties. For user-created tags/classes whose exact ident you have not confirmed, prefer matching by `:block/title` (see the tag/class queries below).

## Input Requirements

Before writing a query, gather the minimum inputs needed for the selected pattern:

- Graph mode: confirm the current graph is a DB graph.
- Entity target: page, block, task, tag/class, property, or journal page.
- Page lookup values: lowercase `:block/name` values.
- Display/search values: exact text or regex pattern for `:block/title`.
- Property idents: full DB idents such as `:logseq.property/priority` or `:user.property/rating-abc123`.
- Property value types: checkbox/boolean, number, node/ref, date, datetime, default/string.
- Date ranges: journal-day integers in `YYYYMMDD` format or millisecond timestamps for datetime properties.
- Task semantics: whether implicit Todo should count when a Task-tagged block has no explicit status.
- Result shape: pulled entity, scalar title, count, or grouped aggregate.

## Tool Input Encoding

Use this Datalog skeleton:

```clojure
[:find <return-values>
 :in $ <inputs>
 :where <clauses>]
```

Encode `inputs` as EDN strings:

```text
"\"(?i)search text\""          ; string input
"\"my lowercase page\""       ; page name string input
":logseq.property/priority"     ; keyword input
"20260706"                      ; number input
"#{\"Todo\" \"Doing\"}"     ; set input
"[\"Urgent\" \"High\"]"     ; vector input
"#uuid \"6a1a83bd-50b7-40b5-8f08-e80576bf2960\"" ; UUID input
```

Example tool payload with multiple inputs:

```json
{
  "datalogString": "[:find (pull ?b [:block/uuid :block/title]) :in $ ?priority-property ?priority-titles ?archived-tag-title :where [?b ?priority-property ?priority] [?priority :block/title ?priority-title] [(contains? ?priority-titles ?priority-title)] (not-join [?b ?archived-tag-title] [?b :block/tags ?archived-tag] [?archived-tag :block/title ?archived-tag-title])]",
  "inputs": [
    ":logseq.property/priority",
    "#{\"Urgent\" \"High\"}",
    "\"archived\""
  ]
}
```

## DB Graph Attribute Basics

Use these DB graph attributes:

- Block/page text: `:block/title`
- Page lookup name: `:block/name`, always lowercase
- Parent page for a block: `:block/page`
- Parent block: `:block/parent`
- Refs/backlinks: `:block/refs`
- Tags/classes on an entity: `:block/tags`
- Tag/class inheritance: `:logseq.property.class/extends`
- Property definitions: entities tagged with `:logseq.class/Property`
- Property schema type: `:logseq.property/type`
- Property ident: `:db/ident`
- Journal day: `:block/journal-day`, stored as `YYYYMMDD` integer
- Task status property: `:logseq.property/status`
- Task priority property: often `:logseq.property/priority`, but still verify before using

## File Graph vs DB Graph

File graphs stored most information as Markdown or Org text. DB graphs store pages, blocks, tags/classes, properties, and many values as first-class database entities.

Do not use file graph query attributes when targeting DB graphs:

| File graph attribute | DB graph replacement |
| --- | --- |
| `:block/content` | `:block/title` |
| `:block/marker` | Task tag plus `:logseq.property/status`, with implicit Todo handling when needed |
| `:block/priority` | Priority property ref, usually `:logseq.property/priority` |
| `:block/properties` | Direct property attributes by ident, such as `:user.property/foo-abc123` |
| `:block/scheduled` | Scheduled/date property ref to a journal page, then `:block/journal-day` |
| `:block/deadline` | Deadline/date property ref to a journal page, then `:block/journal-day` |
| `:block/left` | Do not rely on it in DB graph queries |
| `:block/original-name` | Use `:block/title` for display title |

## Tested Query Ladder

The queries below are ordered from simple to complex. Use their printed query text directly when possible.

### 1. Case-Insensitive Title Search

Use for searching pages, blocks, classes, or property entities by display title.

```clojure
<% #includeFile %>queries/CASE_INSENSITIVE_TITLE_SEARCH.ds<% /includeFile %>
```

Inputs:

```text
"\"(?i)meeting notes\""
```

### 2. Page by Lowercase Name

Use for exact page lookup. The input must be lowercase.

```clojure
<% #includeFile %>queries/PAGE_BY_NAME.ds<% /includeFile %>
```

Inputs:

```text
"\"project alpha\""
```

### 3. Page Reference Backlinks

Use for blocks that reference a page.

```clojure
<% #includeFile %>queries/PAGE_REFERENCE_BACKLINKS.ds<% /includeFile %>
```

Inputs:

```text
"\"project alpha\""
```

### 4. Tag or Child Tag Match

Use when tag inheritance should count. This matches blocks tagged directly with the target class/tag or with a child class/tag that extends it.

```clojure
<% #includeFile %>queries/TAG_OR_CHILD_TAG_MATCH.ds<% /includeFile %>
```

Inputs:

```text
"\"Task\""
```

When the exact built-in tag/class ident is already known, pass that ident as input and derive its class title in the query. This is especially useful for built-in tags such as `:logseq.class/Task`, `:logseq.class/Query`, or `:logseq.class/Math-block`. Do not add a separate `:db/ident` lookup clause for this pattern; blocks created through the Logseq editor APIs are reliably matched through the tag entity attached in `:block/tags`.

```clojure
<% #includeFile %>queries/TAG_IDENT_MATCH.ds<% /includeFile %>
```

Inputs:

```text
":logseq.class/Math-block"
```

### 5. Public Property Schemas

Use before property queries to discover exact idents and value types.

```clojure
<% #includeFile %>queries/PUBLIC_PROPERTY_SCHEMAS.ds<% /includeFile %>
```

Inputs: none.

### 6. Class/Tag Ident Search

Use to discover the exact `:db/ident` of a class/tag. Returns every class/tag whose ident matches the search text, with its display title.

```clojure
<% #includeFile %>queries/CLASS_TAG_IDENT_SEARCH.ds<% /includeFile %>
```

Inputs:

```text
"\"(?i)task\""
```

### 7. Journal Pages in Range

Use for journal page date windows. `:block/journal-day` uses `YYYYMMDD`, not milliseconds.

```clojure
<% #includeFile %>queries/JOURNAL_PAGES_IN_RANGE.ds<% /includeFile %>
```

Inputs:

```text
"20260701"
"20260731"
```

### 8. Property Node List Any

Use for cardinality-many node/ref properties where any selected node title should match.

```clojure
<% #includeFile %>queries/PROPERTY_NODE_LIST_ANY.ds<% /includeFile %>
```

Inputs:

```text
":user.property/assignees-a1b2c3"
"[\"Alice\" \"Bob\"]"
```

### 9. Mixed Property Types and Title Search

Use when the block must match title text, checkbox, number, and node/ref property conditions together.

```clojure
<% #includeFile %>queries/MIXED_PROPERTY_TYPES_AND_TITLE_SEARCH.ds<% /includeFile %>
```

Inputs:

```text
"\"(?i)quarterly review\""
":user.property/approved-a1b2c3"
":user.property/score-d4e5f6"
":user.property/owner-g7h8i9"
"80"
"\"Alice\""
```

### 10. Tasks by Status or Implicit Todo

Use when Logseq UI task semantics matter: a block tagged `Task` with no explicit status counts as `Todo`.

```clojure
<% #includeFile %>queries/TASKS_BY_STATUS_OR_IMPLICIT_TODO.ds<% /includeFile %>
```

Inputs:

```text
"#{\"Todo\" \"Doing\"}"
```

### 11. Tasks Scheduled in Range

Use for active tasks scheduled within a journal-day range. Pass the exact scheduled property ident; do not assume it without checking the graph.

```clojure
<% #includeFile %>queries/TASKS_SCHEDULED_IN_RANGE.ds<% /includeFile %>
```

Inputs:

```text
":logseq.property/scheduled"
"#{\"Todo\" \"Doing\"}"
"20260701"
"20260731"
```

### 12. Tasks With Priority and Not Archived

Use for this filter tree: Task tag AND priority is Urgent or High AND tag is not archived.

```clojure
<% #includeFile %>queries/TASKS_PRIORITY_NOT_ARCHIVED.ds<% /includeFile %>
```

Inputs:

```text
":logseq.property/priority"
"#{\"Urgent\" \"High\"}"
"\"archived\""
```

### 13. Complex Actionable Task Search

Use as the final pattern when the user asks for a rich task search with title text, status, priority, schedule, node-list membership, and exclusion.

```clojure
<% #includeFile %>queries/COMPLEX_ACTIONABLE_TASK_SEARCH.ds<% /includeFile %>
```

Inputs:

```text
"\"(?i)launch\""
"#{\"Todo\" \"Doing\"}"
":logseq.property/priority"
"#{\"Urgent\" \"High\"}"
":logseq.property/scheduled"
"20260701"
"20260731"
":user.property/assignees-a1b2c3"
"#{\"Alice\" \"Bob\"}"
"\"archived\""
```

## Result Handling

The tool returns rows from Logseq. Pull queries commonly return `[[entity] [entity]]`. Scalar queries return rows like `[["title"]]` or `[[5]]`.

When you need only entities, flatten one level in caller code. When you use aggregations or grouped results, do not blindly flatten because rows have meaningful columns.