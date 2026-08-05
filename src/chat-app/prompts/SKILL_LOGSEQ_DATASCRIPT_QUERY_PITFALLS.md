---
name: Logseq Datascript Query Pitfalls
description: Use when a Logseq DB Datascript query fails, returns no rows, uses file-graph syntax, mishandles inputs, or combines tags, properties, tasks, dates, or boolean logic incorrectly.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datascript Query Pitfalls

## Objective

Diagnose and fix failing Logseq DB graph Datascript queries for `LogseqDataScriptQueryTool`. Use this skill to reject old file-graph syntax, identify invalid assumptions, and reduce broken queries back to tested DB graph patterns.

## Context & Rules

- DB graph is the only supported target. Do not write new file graph queries.
- The AI must call `LogseqDataScriptQueryTool`; it does not have direct access to Logseq APIs.
- Never repair a query by swapping random attributes. First identify the entity type, property type, and value storage shape.
- Never assume old Logseq advanced-query snippets work through the tool.
- Never assume task status, priority, scheduled, or deadline are old scalar block attributes.
- Never assume a property key is queryable from its display name. Use the full `:db/ident`.
- Never assume a direct property date value is a number. DB graph date-style queries commonly go through a journal page ref and then `:block/journal-day`.
- Never use `or` when branches bind different variables. Use a tested `or-join` pattern.
- Never use `not` or `not-join` before the entity variable is already bound.
- Never pull everything while debugging. Pull only the identifying fields and the attribute under investigation.
- If a fix requires a query shape not printed in the main skill, test it before presenting it as working.
- Always keep predicate clauses as simple. Avoid predicate composition where possible.

## Input Requirements

To debug a query, collect:

- The exact failing `datalogString`.
- The exact `inputs` array passed to the tool.
- Whether the graph is a DB graph.
- The expected result and one known block/page that should match.
- The property ident and schema if any property is involved.
- The tag/class title and whether child tags should count.
- The date representation expected by the query: `YYYYMMDD` journal day or millisecond timestamp.
- The error message, if Logseq returned one.

## Failure: File Graph Content Attribute

This old file-graph pattern does not find DB graph block text because DB graph block text is stored as `:block/title`.

```clojure
<% #includeFile %>queries/FILE_GRAPH_BLOCK_CONTENT_FAILS.ds<% /includeFile %>
```

Workaround: use the tested case-insensitive title search query in the main skill.

## Failure: Page Name Casing

`:block/name` stores lowercase page names. If the input is `"Project Alpha"` instead of `"project alpha"`, exact page lookup returns no rows.

Workaround: lowercase the page-name input, then use the tested page lookup query in the main skill.

## Failure: Searching Tag Text in Block Title

DB graph tags/classes are entity refs. Searching block title text for a tag marker misses blocks that are actually tagged through `:block/tags`.

```clojure
<% #includeFile %>queries/TAG_TEXT_SEARCH_FAILS.ds<% /includeFile %>
```

Workaround: use the tested tag/class query in the main skill when direct tags or child tags should match.

## Failure: Custom Tags as Stable Idents

Built-in classes may have stable idents such as `:logseq.class/Property`. User-created tags/classes should usually be matched by `:block/title` unless their exact ident has been verified.

Workaround: use tag/class title matching unless the graph has already returned the exact `:db/ident` for the custom class. For LogseqDataScriptQueryTool inputs, do not resolve tag inputs with an extra `:db/ident` clause; use the tested ident query from the main skill.

## Failure: Nested Function Calls When Matching an Ident

`:db/ident` values are keywords. Nesting `(str ?ident)` inside another predicate call in one clause is unreliable: `[(re-find ?pattern (str ?ident))]` errors with `re-find must match against a string`, while `[(clojure.string/includes? (str ?ident) "logseq")]` fails **silently** — returning `[]` with no error.

```clojure
<% #includeFile %>queries/IDENT_REGEX_MATCH_FAILS.ds<% /includeFile %>
```

Workaround: bind `(str ?ident)` to its own variable in a separate clause, then match it.

```clojure
<% #includeFile %>queries/IDENT_SUBSTRING_MATCH.ds<% /includeFile %>
```

Inputs:

```text
"\"(?i)logseq\""
```

## Failure: File Graph Properties Map

DB graph properties are direct attributes on the entity. The old `:block/properties` map pattern does not find DB graph property values.

```clojure
<% #includeFile %>queries/BLOCK_PROPERTIES_MAP_FAILS.ds<% /includeFile %>
```

Workaround: discover property schemas first, then use the tested mixed-property or node-list query in the main skill.

## Failure: Treating Every Property as a String

DB graph property value type changes the query shape:

- Checkbox/boolean: match `true` or `false`.
- Number: bind the number and compare numerically.
- Node/ref: follow the ref entity and match its `:block/title`.
- Cardinality-many node/ref: bind each value and match any wanted ref title.
- Date-style ref: follow the journal page ref and match `:block/journal-day`.

Workaround: use the property schema discovery query in the main skill before writing the property-value query.

## Failure: Old Scheduled/Deadline Block Attributes

DB graph scheduled/deadline-style data should not be queried with old file graph block attributes.

```clojure
<% #includeFile %>queries/BLOCK_SCHEDULED_FAILS.ds<% /includeFile %>
```

Workaround: use the tested scheduled-task date-range query in the main skill. Pass the exact date-ref property ident and the journal-day range as inputs.

## Failure: Missing Implicit Todo Tasks

In DB graphs, a block tagged `Task` with no explicit status can behave as `Todo` in Logseq's UI. A query that only checks explicit status can miss these blocks.

Workaround: use the tested task-status query in the main skill when Todo should include implicit Todo tasks.

## Failure: `or` Branches Bind Different Variables

This shape fails because each `or` branch has a different free-variable set.

```clojure
<% #includeFile %>queries/OR_VARIABLE_MISMATCH_FAILS.ds<% /includeFile %>
```

Workaround: use the tested `or-join` tag/class query or the tested priority query in the main skill, depending on the filter tree.

## Failure: `not` Before Binding the Entity

Negation only works after the entity variable has been bound by earlier clauses. If exclusion appears before the entity exists, the query will fail or return the wrong result.

Workaround: bind the block/page first, then add a tested `not-join` exclusion pattern like the priority-not-archived query in the main skill.

## Debugging Workflow

1. Confirm DB graph mode.
2. Run the tested case-insensitive title search query from the main skill against a unique known title to prove the target block/page exists.
3. Pull only identifying fields such as `:block/uuid`, `:block/title`, `:block/name`, and `:db/ident`.
4. Inspect property definitions with the tested property-schema query from the main skill before querying property values.
5. Add one clause at a time.
6. If a branch needs OR or NOT, switch to a tested `or-join` or `not-join` pattern before adding extra local variables.
7. Once the small query works, move to the closest tested query in the main skill.
