---
name: Logseq Datascript Query Pitfalls
description: Use when a Logseq DB Datascript query fails, returns no rows, or appears to use old file-graph syntax.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Datascript Query Pitfalls

This contains several pitfalls for DB-version Logseq.

## Removed File Graph Attributes

Do not use old file graph attributes in DB queries.

| Old file graph pattern | DB graph replacement |
| --- | --- |
| `:block/content` | `:block/title` |
| `:block/marker` | Use simple DSL for task shortcuts, or first verify current DB task storage through Datascript |
| `:block/properties` | Use `Editor.getBlockProperties` for values; query property schema entities separately |
| `:block/priority` | task/property refs, not old A/B/C marker strings |
| `:block/scheduled` | date refs/journal-day patterns, not a raw block attr |
| `:block/deadline` | date refs/journal-day patterns, not a raw block attr |
| `:block/left` | No tested replacement in this plugin query path |
| `:block/original-name` for display | `:block/title` |

Tested DB replacements:

```clojure
[:find ?title
 :where
 [?b :block/title ?title]
 [(= ?title "Skill query unique title keyword")]]
```

```clojure
[:find ?title
 :where
 [?p :block/name "skill query regression db"]
 [?p :block/title ?title]]
```

## Page Name Casing

` :block/name` stores lowercase names. Query page names in lowercase.

Wrong:

```clojure
[?p :block/name "My Page"]
```

Right:

```clojure
[?p :block/name "my page"]
```

Use `:block/title` when you need original/display casing.

## DSL Rules Are Not Available in Datascript

`DataScriptQueryLogseqTool` did not support DSL rules such as `task`. A query like this returned a rules error:

```clojure
(task ?b #{"Todo" "Doing"})
```

## Custom Tag-Style Refs Need Their Own Tests

Built-in classes may have stable idents, but custom tag-style refs like `#[[Book]]` were not reliable in the current proxy tests. Do not add a tag/ref query to a skill until it has a passing regression case.

Wrong for custom tags:

```clojure
[?tag :db/ident :logseq.class/Book]
```

Right: 
<TBU>

## Debugging Pattern

Pull narrow attributes first instead of pulling everything:

```clojure
[:find (pull ?b [:block/uuid :block/title])
 :where
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "keyword")]]
```
