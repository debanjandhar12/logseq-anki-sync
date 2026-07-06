---
name: Logseq Datascript Query
description: Use this skill whenever the user mentions Logseq DB queries, advanced queries, Datalog or Datascript. Also trigger when the user mentions Logseq tasks, scheduled dates, deadlines, journal queries, properties, tags-as-classes.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datascript Query Skill

Use `LogseqDataScriptQueryTool` for full Datascript/Datalog queries in DB graphs.

## Tool Shape

Pass the query as `datalogString`. Pass each `:in` value as a string in `inputs`; the tool spreads them into `logseq.DB.datascriptQuery(datalogString, ...inputs)`.

Datalog Structure:

```clojure
[:find <return-values>
 :in $ <inputs>
 :where <clauses>]
```

Input string examples:

```text
"my page"
#uuid "6a1a83bd-50b7-40b5-8f08-e80576bf2960"
123
:keyword
```

Note: 
- UUID inputs must use EDN UUID syntax
- Use `:block/title` for block text in DB graphs.
- Use lowercase `:block/name` for page lookup.
- Input strings need double wrapping when passed as params to datascript query tool: ""my page"". The datascript wrapper will then interpret it as a string.

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

Do not use file graph attributes like `:block/content`, `:block/marker`, `:block/properties`, `:block/scheduled`, `:block/deadline`, `:block/priority`, or `:block/left`. File Graphs are something that used to exist in older versions of Logseq.

## Tested Query Patterns

### Blocks by Title Text

```clojure
<% #includeFile %>queries/SEARCH_BLOCK_AND_PAGES.ds<% /includeFile %>
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

## Result Handling

`datascriptQuery` returns rows. Pull queries commonly return `[[entity] [entity]]`; scalar queries return rows like `[["title"]]` or `[[5]]`.
