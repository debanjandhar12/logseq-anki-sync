---
name: Logseq Datascript Query
description: Use when writing DB-version Logseq Datascript queries for DataScriptQueryLogseqTool. Covers tested DB graph attributes, page/reference queries, tags/classes, inputs, and boolean clauses.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datascript Query Skill

Use `DataScriptQueryLogseqTool` for full Datascript/Datalog queries in DB graphs. The plugin does not support the old markdown/file graph schema for these skills.

## Tool Shape

Pass the query as `datalogString`. Pass each `:in` value as a string in `inputs`; the tool spreads them into `logseq.DB.datascriptQuery(datalogString, ...inputs)`.

Input string examples:

```text
"my page"
#uuid "6a1a83bd-50b7-40b5-8f08-e80576bf2960"
123
:keyword
```

## DB Graph Basics

Use these DB-version attributes:

- Block text/content: `:block/title`
- Page lookup name: `:block/name`, always lowercase
- Original display title: `:block/title`
- Page/block parent page: `:block/page`
- Parent block: `:block/parent`
- References/backlinks: `:block/refs`; verify against the current graph before documenting a specific ref pattern
- Entity type: `:block/type`, such as `"page"`, `"class"`, `"property"`
- Journal day: `:block/journal-day`
- Journal page marker: `:block/journal? true`
- Block order may exist in DB graphs, but do not rely on it until tested against the current SDK path

Do not use file graph attributes like `:block/content`, `:block/marker`, `:block/properties`, `:block/scheduled`, `:block/deadline`, `:block/priority`, or `:block/left`.

## Tested Query Patterns

### Blocks by Title Text

```clojure
[:find (pull ?b [:block/uuid :block/title])
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "keyword")]]
```

### Blocks on a Page

Use lowercase page names with `:block/name`.

```clojure
[:find ?title
 :in $ ?page-name
 :where
 [?p :block/name ?page-name]
 [?b :block/page ?p]
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "search text")]]
```

Inputs:

```text
"skill query regression db"
```

### Page by Lowercase Name

```clojure
[:find ?title
 :where
 [?p :block/name "page title"]
 [?p :block/title ?title]]
```

### Excluding Matches

```clojure
[:find ?title
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "Skill query")]
 (not [?b :block/title "Skill query property block"])]
```

## Result Handling

`datascriptQuery` returns rows. Pull queries commonly return `[[entity] [entity]]`; scalar queries return rows like `[["title"]]` or `[[5]]`.
