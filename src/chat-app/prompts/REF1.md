# Logseq Datalog Query Examples

This reference provides comprehensive examples of datalog queries for the Logseq CLI.

## Basic Query Patterns

### Find All Blocks

```clojure
[:find (pull ?b [*])
 :where [?b :block/content]]
```

### Find Blocks by Title

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/title ?title]
 [(clojure.string/includes? ?title "keyword")]]
```

### Find Blocks Created After Date

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/created-at ?created]
 [(> ?created 1700000000000)]]
```

### Find Blocks with Specific Tag

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/tags ?tag]
 [?tag :block/name "tag-name"]]
```

### Find Journal Pages

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/journal-day]]
```

### Find Pages (Not Blocks)

```clojure
[:find (pull ?p [*])
 :where 
 [?p :block/title]
 [(missing? $ ?p :block/parent)]]
```

## Property-Based Queries

### Find Blocks with Specific Property

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/properties ?props]
 [(get ?props :property-name)]]
```

### Find Blocks with Property Value

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/properties ?props]
 [(get ?props :property-name) ?val]
 [(= ?val "expected-value")]]
```

## Reference and Link Queries

### Find Blocks Referencing a Page

```clojure
[:find (pull ?b [*])
 :where 
 [?ref :block/name "page-name"]
 [?b :block/refs ?ref]]
```

### Find Bidirectional Links

```clojure
[:find (pull ?b [*])
 :where 
 [?page :block/name "page-name"]
 [?b :block/refs ?page]
 [?page :block/refs ?b]]
```

### Find Blocks with Multiple References

```clojure
[:find (pull ?b [*])
 :where 
 [?ref1 :block/name "page1"]
 [?ref2 :block/name "page2"]
 [?b :block/refs ?ref1]
 [?b :block/refs ?ref2]]
```

## Task and TODO Queries

### Find TODO Items

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/marker ?marker]
 [(= ?marker "TODO")]]
```

### Find Completed Tasks

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/marker ?marker]
 [(= ?marker "DONE")]]
```

### Find Tasks by Priority

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/priority ?priority]
 [(= ?priority "A")]]
```

### Find Overdue Tasks

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/marker ?marker]
 [(contains? #{"TODO" "DOING"} ?marker)]
 [?b :block/scheduled ?scheduled]
 [(< ?scheduled (js/Date.now))]]
```

## Time-Based Queries

### Find Recently Modified Blocks

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/updated-at ?updated]
 [(> ?updated 1700000000000)]]
```

### Find Blocks Modified in Date Range

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/updated-at ?updated]
 [(>= ?updated 1700000000000)]
 [(<= ?updated 1701000000000)]]
```

### Find Today's Journal Page

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/journal-day ?day]
 [(= ?day 20251017)]]
```

## Advanced Pattern Matching

### Find Blocks with Nested Content

```clojure
[:find (pull ?parent [* {:block/children ...}])
 :where 
 [?parent :block/children ?child]
 [?child :block/content ?content]
 [(clojure.string/includes? ?content "keyword")]]
```

### Find Orphaned Blocks

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/content]
 [(missing? $ ?b :block/refs)]
 [(missing? $ ?b :block/tags)]]
```

### Count Blocks by Type

```clojure
[:find ?marker (count ?b)
 :where 
 [?b :block/marker ?marker]]
```

### Find Most Referenced Pages

```clojure
[:find ?page (count ?ref)
 :where 
 [?page :block/name]
 [?ref :block/refs ?page]]
```

## Content Analysis Queries

### Find Blocks with Word Count

```clojure
[:find ?b (count ?words)
 :where 
 [?b :block/content ?content]
 [(clojure.string/split ?content #"\s+") ?words]]
```

### Find Long-Form Content

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/content ?content]
 [(count ?content) ?len]
 [(> ?len 500)]]
```

### Find Blocks with URLs

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/content ?content]
 [(clojure.string/includes? ?content "http")]]
```

## Namespace and Hierarchy Queries

### Find Pages in Namespace

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/name ?name]
 [(clojure.string/starts-with? ?name "namespace/")]]
```

### Find Child Pages

```clojure
[:find (pull ?b [*])
 :where 
 [?parent :block/name "parent-page"]
 [?b :block/namespace ?parent]]
```

### Find All Descendants

```clojure
[:find (pull ?b [*])
 :where 
 [?ancestor :block/name "ancestor-page"]
 [?b :block/path-refs ?ancestor]]
```

## Graph Statistics Queries

### Count Total Blocks

```clojure
[:find (count ?b)
 :where [?b :block/content]]
```

### Count Pages

```clojure
[:find (count ?p)
 :where 
 [?p :block/title]
 [(missing? $ ?p :block/parent)]]
```

### Count Tags

```clojure
[:find (count ?t)
 :where [?t :block/name]
 [?b :block/tags ?t]]
```

### Average Block Length

```clojure
[:find (avg ?len)
 :where 
 [?b :block/content ?content]
 [(count ?content) ?len]]
```

## Combined Complex Queries

### Academic Research Query

Find all blocks tagged with "research" that have citations:

```clojure
[:find (pull ?b [*])
 :where 
 [?tag :block/name "research"]
 [?b :block/tags ?tag]
 [?b :block/content ?content]
 [(clojure.string/includes? ?content "[[")]]
```

### Literature Review Query

Find all blocks with book references created in last 30 days:

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/content ?content]
 [(clojure.string/includes? ?content "book")]
 [?b :block/created-at ?created]
 [(> ?created (- (js/Date.now) 2592000000))]]
```

### Teaching Materials Query

Find all blocks tagged with course codes:

```clojure
[:find (pull ?b [*])
 :where 
 [?b :block/tags ?tag]
 [?tag :block/name ?name]
 [(re-matches #"[A-Z]{4}\d{3,4}" ?name)]]
```

## Query Optimization Tips

1. **Use specific attributes** - Query by indexed attributes like `:block/uuid` or `:block/name` when possible
2. **Filter early** - Apply restrictive conditions first to reduce result set
3. **Limit pulls** - Use `(pull ?e [:block/content :block/title])` instead of `(pull ?e [*])` for specific fields
4. **Use rules** - Define reusable query patterns with Datalog rules
5. **Index awareness** - Queries on `:db/id`, `:block/uuid`, `:block/name` are fastest

## Common Pitfalls

1. **Missing entity checks** - Use `(missing? $ ?e :attribute)` to check for absent attributes
2. **String matching** - Use `clojure.string/includes?` or regex for partial matches
3. **Date comparisons** - Timestamps are in milliseconds since epoch
4. **Case sensitivity** - Block names and tags are case-insensitive in Logseq
5. **Pull patterns** - Recursive pulls like `[* {:block/children ...}]` can be expensive

## API Query Shortcuts

When using API mode with `-a` token, these simple query patterns work:

- `(task TODO)` - Find TODO tasks
- `(task DOING)` - Find in-progress tasks
- `(task DONE)` - Find completed tasks
- `(priority A)` - Find high priority items
- `(priority B)` - Find medium priority items
- `(priority C)` - Find low priority items
- `(and (task TODO) (priority A))` - Combined filters
- `(between [[yesterday]] [[tomorrow]])` - Date range queries

These simple queries are converted to full datalog by the API layer.

## Resources

For more information:
- Logseq Datalog documentation: docs.logseq.com
- Datascript documentation: github.com/tonsky/datascript
- Query examples in Logseq forums and Discord
- Community query library: github.com/logseq/awesome-logseq
