---
name: Logseq Datalog Query
description: Use when explaining tested Datalog syntax and Logseq DB-version query forms for DataScriptQueryLogseqTool. Covers aggregation, grouping, min/max, and input syntax.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datalog Query Skill

Use this with `DataScriptQueryLogseqTool` for Datalog vectors. This skill is DB-version only.

## Datalog Structure

```clojure
[:find <return-values>
 :in $ <inputs>
 :where <clauses>]
```

Common return values:

- Entity id: `?b`
- Pulled entity: `(pull ?b [:block/uuid :block/title])`
- Count: `(count ?b)`
- Numeric bounds: `(min ?length) (max ?length)`

## Tested Aggregation Queries

### Count Matching Blocks

```clojure
[:find (count ?b)
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "Skill query")]]
```

### Group Matching Blocks by Page

```clojure
[:find ?page-name (count ?b)
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "Skill query")]
 [?b :block/page ?p]
 [?p :block/name ?page-name]]
```

### Min and Max Derived Title Length

```clojure
[:find (min ?length) (max ?length)
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "Skill query")]
 [(count ?title) ?length]]
```

## Inputs

When using `:in`, include `$` first and pass each input through the tool's `inputs` array.

```clojure
[:find ?title
 :in $ ?page-name
 :where
 [?p :block/name ?page-name]
 [?b :block/page ?p]
 [?b :block/title ?title]]
```

Inputs:

```text
"my page"
```

UUID inputs must use EDN UUID syntax:

```text
#uuid "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Practical Rules

- `logseq.DB.datascriptQuery` does not automatically provide Logseq query rules like `task`; use simple DSL for that style only after testing against the active graph.
- Use `:block/title` for block text in DB graphs.
- Use lowercase `:block/name` for page lookup.
- Use narrow pull patterns instead of `[*]` unless full entity inspection is needed.
