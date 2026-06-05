---
name: logseq-db-queries
description: Use this skill whenever the user mentions Logseq DB queries, advanced queries, Datalog, Datascript, or any query migration from file-based to DB-based Logseq. Also trigger when the user mentions Logseq tasks, scheduled dates, deadlines, journal queries, properties, tags-as-classes, or any Logseq query that uses file-graph attributes like block/marker, block/scheduled, block/content, block/properties -- these ALL need migration for DB version. Even if the user just says "Logseq query" without specifying DB version, consult this skill because they may be using outdated file-graph syntax without knowing it. Covers schema changes, working patterns, critical pitfalls, and confirmed non-working patterns.
---

# Logseq DB Version -- Inline Advanced Query Guide

Empirically verified against a live DB graph, April 2026. Combined with official Logseq SDK query guide.

Inline queries use {:query [...]} syntax in blocks. They run in SCI (sandboxed Clojure interpreter) with NO JavaScript access. SDK plugin queries use logseq.DB.datascriptQuery() with full JS -- not covered here.

TABLE OF CONTENTS:
Section 1: Critical rules (read first -- traps that silently break queries)
Section 2: Complete attribute reference (File Graph vs DB Graph, every attribute)
Section 3: Migration lookup table (File element --> DB replacement)
Section 4: Working inline query patterns (copy-paste ready)
Section 5: Dynamic input variables
Section 6: Predicate functions for :where clauses
Section 7: SCI sandbox -- what works in result-transform and view
Section 8: Confirmed non-working patterns
Section 9: Debugging queries


## SECTION 1: CRITICAL RULES (read first)

RULE 1 -- NO JS IN INLINE QUERIES:
result-transform and view run in SCI. js/Date, js/Date.now, js/console.log all SILENTLY FAIL (return nil, do not throw). Every comparison using nil passes, so all items appear in results. Never use js/* in inline queries.

RULE 2 -- PROPERTY ATTRIBUTES CANNOT BE USED IN :where CLAUSES:
Attributes like :logseq.property/scheduled, :logseq.task/scheduled, :logseq.property/deadline are materialized by pull but do NOT exist as raw Datascript attributes. Using them in :where causes Query Error.

WRONG (Query Error):
```clojure
[?b :logseq.property/scheduled ?d]
```
WRONG (Query Error):
```clojure
[?b :logseq.task/scheduled ?d]
```
WRONG (3-arg property rule broken):
```clojure
(property ?b :logseq.property/scheduled ?d)
```
RIGHT (pull can access them):
```clojure
(pull ?b [:logseq.property/scheduled])
```
RIGHT (2-arg property rule for existence check only):
```clojure
(property ?b :logseq.property/scheduled)
```

RULE 3 -- DATE PROPERTIES ARE REFS, NOT VALUES:
Scheduled and deadline dates are stored as references to journal day entities. To filter by date, go through :block/refs to reach :block/journal-day (YYYYMMDD integer).

WRONG:
```clojure
[?b :logseq.property/scheduled ?d]
[(< ?d ?today)]
```
RIGHT:
```clojure
[?b :block/refs ?ref]
[?ref :block/journal-day ?d]
[(< ?d ?today)]
```
CAVEAT: :block/refs catches ALL date references on a block (journal page, scheduled, deadline, inline mentions). Always deduplicate:
```clojure
:result-transform (fn [result] (distinct result))
```

RULE 4 -- STATUS VALUES ARE CAPITALIZED:
"Todo" not "TODO". "Doing" not "DOING". "Done" not "DONE".

RULE 5 -- DEPRECATED OPTIONS:
Do not use :title, :collapsed?, or :group-by-page? in DB version queries.

RULE 6 -- PAGE NAMES ARE LOWERCASE:
:block/name stores lowercase names. Convert before querying. Use :block/title for original casing.


## SECTION 2: COMPLETE ATTRIBUTE REFERENCE (File Graph vs DB Graph)

### Block Attributes

:block/uuid
File: YES  DB: YES  Type: UUID
Description: Unique block identifier. Works the same in both.

:block/content
File: YES  DB: NO
Description: Raw block text content. REMOVED in DB. Use :block/title instead.
File query:  [?b :block/content ?c]
DB query:    [?b :block/title ?t]

:block/title
File: NO   DB: YES  Type: String
Description: Block title/content. Replaces :block/content in DB.
DB query:    [?b :block/title ?t]

:block/page
File: YES  DB: YES  Type: Ref
Description: Parent page reference. Works the same in both.
Query:       [?b :block/page ?p]

:block/parent
File: YES  DB: YES  Type: Ref
Description: Parent block reference. Works the same in both.
Query:       [?b :block/parent ?parent]

:block/left
File: YES  DB: NO   Type: Ref
Description: Left sibling block. REMOVED in DB. Use :block/order instead.

:block/order
File: NO   DB: YES  Type: String
Description: Fractional index for block ordering. Replaces :block/left.

:block/refs
File: YES  DB: YES  Type: Ref[]
Description: All referenced pages/blocks. Works the same in both.
Query:       [?b :block/refs ?ref]
NOTE in DB: Date properties (scheduled, deadline) create refs to journal day entities.
This is the workaround for querying scheduled/deadline dates.

:block/marker
File: YES  DB: NO   Type: String
Description: Task marker "TODO", "DOING", "DONE", etc. REMOVED in DB.
File query:  [?b :block/marker "TODO"]
DB replacement: (task ?b #{"Todo"}) or ref chain (see migration table)

:block/priority
File: YES  DB: NO   Type: String
Description: Priority "A", "B", "C". REMOVED in DB.
File query:  [?b :block/priority "A"]
DB replacement: (priority ?b #{"High"}) or ref chain through :logseq.property/priority

:block/scheduled
File: YES  DB: NO   Type: Int (YYYYMMDD)
Description: Scheduled date as integer. REMOVED in DB.
File query:  [?b :block/scheduled ?d] [(>= ?d ?start)]
DB replacement: [?b :block/refs ?ref] [?ref :block/journal-day ?d] [(>= ?d ?start)]
MUST add: :result-transform (fn [result] (distinct result))

:block/deadline
File: YES  DB: NO   Type: Int (YYYYMMDD)
Description: Deadline date as integer. REMOVED in DB.
File query:  [?b :block/deadline ?d]
DB replacement: Same as scheduled -- use :block/refs + :block/journal-day workaround.

:block/properties
File: YES  DB: NO   Type: Map
Description: Properties as key-value map. REMOVED in DB.
File query:  [?b :block/properties ?props] [(get ?props :key) ?v]
DB replacement: Properties are separate entities. Use :user.property/NAME-HASH or pull.

:block/tags
File: YES  DB: YES  Type: Ref[]
Description: Tag references. Works in both but more important in DB (tags = classes).
Query:       [?b :block/tags ?t] [?t :block/title "TagName"]
Stable:      [?b :block/tags ?t] [?t :db/ident :logseq.class/Task]

:block/link
File: NO   DB: YES  Type: Ref
Description: Link to class/tag in DB Graph.

:block/created-at
File: YES  DB: NO   Type: Int (ms timestamp)
Description: Creation timestamp. REMOVED as direct attribute in DB.
DB replacement: :logseq.property/created-at (accessible via pull, queryable in SDK)

:block/updated-at
File: YES  DB: NO   Type: Int (ms timestamp)
Description: Update timestamp. REMOVED as direct attribute in DB.
DB replacement: :logseq.property/updated-at (accessible via pull, queryable in SDK)

### Page Attributes

:block/name
File: YES  DB: YES  Type: String
Description: Page name, always lowercase. Works the same in both.
Query:       [?p :block/name "my-page"]

:block/original-name
File: YES  DB: YES  Type: String
Description: Original page name with casing.
File query:  [?p :block/original-name ?n]
DB query:    [?p :block/title ?n]  (original-name renamed to title in DB)

:block/journal?
File: YES  DB: YES  Type: Boolean
Description: Whether page is a journal page. Works in both.
Query:       [?p :block/journal? true]

:block/journal-day
File: YES  DB: YES  Type: Int (YYYYMMDD)
Description: Journal date as YYYYMMDD integer. Works in both.
Query:       [?p :block/journal-day ?d]
NOTE: In DB inline queries, sometimes must be reached via ref chain.
Direct access on journal pages works in SDK queries.

:page/journal-day
File: YES  DB: NO
Description: Old namespace for journal day. REMOVED. Use :block/journal-day.

:block/type
File: NO   DB: YES  Type: String
Description: Entity type. Values: "page", "class", "property", "whiteboard".
DB query:    [?p :block/type "page"]

:block/format
File: YES  DB: NO   Type: Keyword
Description: File format :markdown or :org. REMOVED in DB (no files).

:block/file
File: YES  DB: NO   Type: Ref
Description: Associated file reference. REMOVED in DB (no files).

### DB-Only System Properties (logseq.property namespace)

:logseq.property/created-at
Type: Int (ms timestamp). Creation timestamp.
Inline :where: NOT tested. Use pull.
SDK :where: YES -- [?p :logseq.property/created-at ?created]

:logseq.property/updated-at
Type: Int (ms timestamp). Update timestamp.
Inline :where: NOT tested. Use pull.
SDK :where: YES.

:logseq.property/status
Type: Ref to status entity.
Inline :where: YES via ref chain -- [?b :logseq.property/status ?s] [?s :block/title "Todo"]
Pull: YES -- (pull ?b [:logseq.property/status])

:logseq.property/scheduled
Type: Ref to date entity.
Inline :where: NO (Query Error). Use :block/refs workaround.
Pull: YES -- returns ms timestamp.

:logseq.property/deadline
Type: Ref to date entity.
Inline :where: NO (Query Error). Use :block/refs workaround.
Pull: YES.

:logseq.property/priority
Type: Ref to priority entity.
Inline :where: Untested. Likely needs ref chain like status.
Pull: YES.

:logseq.property/icon
Type: Object {type, id}. Icon definition.
Inline :where: Not useful for queries.

:logseq.property/hide-empty-value
Type: Boolean. Applied to property entities.

:logseq.property/closed-value-mode
Type: Boolean. Enum mode for property.

:logseq.property/closed-values
Type: Array. Allowed enum values.

:logseq.property/schema
Type: Object. Property schema definition.

:logseq.property.class/extends
Type: Ref[]. Parent class references (tag inheritance).

:logseq.property.class/properties
Type: Ref[]. Properties defined on a class/tag.

### DB-Only Task Attributes (logseq.task namespace)

:logseq.task/status
Type: Ref. Task status. Used in SDK queries.
SDK :where: [?b :logseq.task/status ?s] [?s :db/ident :logseq.task/status.todo]
Inline :where: Query Error. Use (task ?b #{"Todo"}) rule instead.

:logseq.task/priority
Type: Ref. Task priority.
SDK :where: Likely works via ref chain.
Inline :where: Query Error. Use (priority ?b #{"High"}) rule.

:logseq.task/deadline
Type: Ref. Task deadline.
SDK :where: Untested.
Inline :where: Query Error. Use :block/refs workaround.

:logseq.task/scheduled
Type: Ref. Task scheduled date.
SDK :where: Untested.
Inline :where: Query Error. Use :block/refs workaround.

### User and Plugin Properties

User-created properties:
Ident format: :user.property/NAME-HASH (e.g., :user.property/Player-bEMnJKfg)
Query: [?b :user.property/Player-bEMnJKfg ?v]
Stable query via ident: [?prop :db/ident :user.property/Player-bEMnJKfg] [?b ?prop ?v]

Plugin-created properties:
Ident format: :plugin.property.PLUGIN-ID/NAME
Query: same pattern as user properties.

Plugin-created classes:
Ident format: :plugin.class.PLUGIN-ID/NAME

Cardinality:
one  -- single value (default). Clause binds one value.
many -- multiple values. Clause matches once per value, producing duplicate rows.
Always use distinct or pull to deduplicate.

### Ident Naming Conventions

:logseq.property/NAME        -- built-in system properties
:logseq.property.class/NAME  -- class/tag schema properties
:logseq.class/NAME           -- built-in classes: Task, Journal, Page, Tag, Property
:logseq.task/NAME            -- task-specific: status, priority, deadline, scheduled
:logseq.property/status.X    -- closed value idents: status.todo, status.doing, status.done
:user.property/NAME-HASH     -- user-created properties
:plugin.property.ID/NAME     -- plugin-created properties
:plugin.class.ID/NAME        -- plugin-created classes

Querying by ident is stable across renames:
[?t :db/ident :logseq.class/Task]      -- survives if user renames Task tag
[?s :db/ident :logseq.property/status.todo]  -- survives status label rename

### Property Types and Storage

default   -- text/string, may contain inline refs. Stored as ref to text block or string.
number    -- scalar numeric value. Direct comparison works.
date      -- ref to journal day entity. NOT a raw value. Must follow ref chain.
datetime  -- scalar ms timestamp. Direct comparison if accessible.
checkbox  -- boolean true/false.
url       -- ref to URL entity. Follow ref for URL string.
node      -- ref to page/block entity. Must follow ref: [?b :prop ?ref] [?ref :block/title ?name]


## SECTION 3: MIGRATION LOOKUP TABLE

When migrating a file-graph query to DB-graph, replace each element:

Task status:
[?b :block/marker "TODO"]              --> (task ?b #{"Todo"})
[?b :block/marker "DOING"]             --> (task ?b #{"Doing"})
[?b :block/marker ?m]                  --> (task ?b #{"Todo" "Doing"})
[(contains? #{"TODO" "DOING"} ?m)]     --> (already handled by task rule set)

Alternative task status (without task rule):
[?b :block/marker "TODO"]              --> [?b :block/tags ?t]
[?t :block/title "Task"]
[?b :logseq.property/status ?s]
[?s :block/title "Todo"]

Stable task query (survives renames):
--> [?b :block/tags ?tag]
[?tag :db/ident :logseq.class/Task]
[?b :logseq.property/status ?s]
[?s :db/ident :logseq.property/status.todo]

Journal check:
[?page :block/journal?]                --> remove (redundant if using :block/journal-day)
[?page :block/journal? true]           --> [?p :block/journal? true] (still works)

Journal day:
[?page :page/journal-day ?d]           --> [?page :block/journal-day ?d]

Scheduled date:
[?b :block/scheduled ?d]              --> [?b :block/refs ?ref]
[?ref :block/journal-day ?d]
+ :result-transform (fn [result] (distinct result))

Deadline date:
[?b :block/deadline ?d]               --> same as scheduled workaround

Block content:
[?b :block/content ?c]                --> [?b :block/title ?t]
:block/content                        --> :block/title (everywhere)

Page original name:
[?p :block/original-name ?n]          --> [?p :block/title ?n]

Properties map:
[?b :block/properties ?props]         --> properties are entities, not maps
[(get ?props :key) ?v]                --> use :user.property/KEY-HASH or pull

Priority:
[?b :block/priority "A"]             --> (priority ?b #{"High"}) or ref chain

Left sibling:
[?b :block/left ?left]               --> not available, use :block/order

Created/updated timestamps:
[?b :block/created-at ?t]            --> pull :logseq.property/created-at (not in :where inline)
[?b :block/updated-at ?t]            --> pull :logseq.property/updated-at (not in :where inline)

File reference:
[?b :block/file ?f]                  --> removed, no files in DB version

Format:
[?b :block/format :markdown]         --> removed, no format in DB version

Path refs:
[?b :block/path-refs ?ref]           --> use (has-ref ?b ?ref) or :block/refs

Query options:
:title "..."                          --> remove (deprecated)
:collapsed? false                     --> remove (deprecated)
:group-by-page? true                  --> remove (deprecated)


## SECTION 4: WORKING INLINE QUERY PATTERNS

PATTERN: Tasks by status
```clojure
{:query [:find (pull ?b [*])
         :where
         (task ?b #{"Todo" "Doing"})]}
```

PATTERN: Tasks on past journal pages
```clojure
{:query [:find (pull ?b [*])
         :in $ ?today
         :where
         (task ?b #{"Todo" "Doing"})
         [?b :block/page ?page]
         [?page :block/journal-day ?d]
         [(< ?d ?today)]]
 :inputs [:today]}
```

PATTERN: Tasks scheduled for today
```clojure
{:query [:find (pull ?b [*])
         :in $ ?today
         :where
         (task ?b #{"Todo" "Doing"})
         [?b :block/refs ?ref]
         [?ref :block/journal-day ?d]
         [(= ?d ?today)]]
 :inputs [:today]
 :result-transform (fn [result] (distinct result))}
```

PATTERN: Tasks scheduled in date range
```clojure
{:query [:find (pull ?b [*])
         :in $ ?start ?end
         :where
         (task ?b #{"Todo" "Doing"})
         [?b :block/refs ?ref]
         [?ref :block/journal-day ?d]
         [(> ?d ?start)]
         [(<= ?d ?end)]]
 :inputs [:today :3d-after]
 :result-transform (fn [result] (distinct result))}
```

PATTERN: Tasks in progress only
```clojure
{:query [:find (pull ?b [*])
         :where
         (task ?b #{"Doing"})]}
```

PATTERN: Tasks under a specific parent block
```clojure
{:query [:find (pull ?b [*])
         :in $ ?today
         :where
         (task ?b #{"Todo" "Doing"})
         [?b :block/page ?page]
         [?page :block/journal-day ?d]
         [(< ?d ?today)]
         [?b :block/parent ?parent]
         [?parent :block/title "Parent Block Name"]]
 :inputs [:today]}
```

PATTERN: Exclude tasks under specific parent blocks
```clojure
(not-join [?b]
  [?b :block/parent ?parent]
  [?parent :block/title ?parent-title]
  [(contains? #{"Excluded 1" "Excluded 2"} ?parent-title)])
```

PATTERN: Property existence check (no date filter)
```clojure
{:query [:find (pull ?b [*])
         :where
         (task ?b #{"Todo" "Doing"})
         (property ?b :logseq.property/scheduled)]}
```

PATTERN: Content/title search
```clojure
{:query [:find (pull ?b [*])
         :where
         [?b :block/title ?t]
         [(clojure.string/includes? ?t "search term")]]}
```

PATTERN: Blocks referencing a specific page
```clojure
{:query [:find (pull ?b [*])
         :where
         [?p :block/name "target-page"]
         [?b :block/refs ?p]]}
```

PATTERN: Block references (backlinks to a specific block)
```clojure
{:query [:find (pull ?b [*])
         :in $ ?uuid
         :where
         [?target :block/uuid ?uuid]
         [?b :block/refs ?target]]
 :inputs [...]}
```

PATTERN: Journal pages in date range
```clojure
{:query [:find (pull ?p [*])
         :where
         [?p :block/journal? true]
         [?p :block/journal-day ?d]
         [(>= ?d 20250101)]
         [(<= ?d 20250131)]]}
```

PATTERN: All pages of a specific type (DB only)
```clojure
{:query [:find (pull ?p [*])
         :where
         [?p :block/type "page"]]}
```

PATTERN: All class/tag definitions (DB only)
```clojure
{:query [:find (pull ?p [*])
         :where
         [?p :block/type "class"]]}
```

PATTERN: All instances of a user-defined tag
```clojure
{:query [:find (pull ?b [*])
         :where
         [?b :block/tags ?t]
         [?t :block/title "Book"]]}
```

PATTERN: User property query (DB only)
```clojure
{:query [:find (pull ?b [*])
         :where
         [?b :user.property/my-prop-HASH ?v]
         [?v :block/title "value"]]}
```

PATTERN: NOT clause
```clojure
(not [?b :block/refs ?ref]
     [?ref :block/title "excluded-tag"])
```

PATTERN: OR clause
```clojure
(or [?b :logseq.property/status ?s1]
    [?b :logseq.property/status ?s2])
```

PATTERN: OR-JOIN with AND
```clojure
(or-join [?b]
  (and [?b :logseq.property/status ?s]
       [?s :block/title "Todo"])
  (and [?b :logseq.property/status ?s]
       [?s :block/title "Doing"]))
```

PATTERN: Count tasks
```clojure
[:find (count ?b) :where (task ?b #{"Todo"})]
```

PATTERN: Group by page with count
```clojure
[:find ?name (count ?b)
 :where (task ?b #{"Todo"})
 [?b :block/page ?p] [?p :block/name ?name]]
```

PATTERN: Min/Max date
```clojure
[:find (min ?d) (max ?d)
 :where [?p :block/journal? true] [?p :block/journal-day ?d]]
```


## SECTION 5: DYNAMIC INPUT VARIABLES

Date inputs (YYYYMMDD integers):
:today              -- today
:tomorrow           -- tomorrow
:yesterday          -- yesterday
:Xd-after           -- X days from today (e.g., :3d-after, :7d-after, :10d-after)
:Xd                 -- X days ago (e.g., :14d)

Relative dates (direction + amount + unit):
:+1d, :-3d, :+2w, :-1m, :+1y

Timestamp inputs (milliseconds):
:start-of-today-ms, :end-of-today-ms, :right-now-ms
:-1d-ms (past dates get 00:00:00.000, future get 23:59:59.999)

Special:
:query-page         -- lowercase name of page containing the query
:current-block      -- :db/id of current block

Parameter format for SDK queries:
Strings: "value"
Numbers: 123
UUIDs: #uuid "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
Keywords: :keyword
Collections: ["a" "b" "c"]


## SECTION 6: PREDICATE FUNCTIONS FOR :where CLAUSES

Comparison:
[(> ?d 20250101)]    [(>= ?d 20250101)]
[(< ?d 20250131)]   [(<= ?d 20250131)]
[(= ?v "value")]    [(not= ?v "value")]

String:
[(clojure.string/includes? ?s "text")]
[(clojure.string/starts-with? ?s "prefix")]
[(clojure.string/ends-with? ?s "suffix")]
[(clojure.string/blank? ?s)]

Collection:
[(contains? #{"A" "B" "C"} ?v)]

Null:
[(some? ?v)]   [(nil? ?v)]

Math (bind result to new variable):
[(+ ?a ?b) ?sum]   [(- ?a ?b) ?diff]   [(* ?a ?b) ?product]

NOT and OR:
(not [?b :block/priority "C"])
(or [?b :block/marker "TODO"] [?b :block/marker "DOING"])
(or-join [?b] (and ...) (and ...))
(not-join [?b] ...)


## SECTION 7: SCI SANDBOX -- WHAT WORKS IN result-transform AND view

WORKS: filter, map, sort-by, distinct, reduce, take, drop, first, last, rest
WORKS: pr-str, str, count, get, get-in, assoc, dissoc, update, merge
WORKS: contains? (sets), some?, nil?, number?, string?, keyword?
WORKS: +, -, *, /, mod, inc, dec, max, min
WORKS: =, not=, <, >, <=, >=, compare
WORKS: inst-ms (but cannot create "now" without js/Date)
WORKS: hiccup in :view -- [:pre ...], [:ul ...], [:li ...], [:div ...], [:a ...]

DOES NOT WORK (silently fails): js/Date, js/Date.now, js/parseInt
DOES NOT WORK (throws error): js/console.log, clj->js, js->clj
DOES NOT WORK: resolve, eval, require


## SECTION 8: CONFIRMED NON-WORKING PATTERNS IN INLINE QUERIES

1. [?b :logseq.property/scheduled ?d] in :where -- Query Error
2. [?b :logseq.task/scheduled ?d] in :where -- Query Error
3. (property ?b :logseq.property/scheduled ?d) -- 3-arg rule broken
4. [entity-id ?a ?v] wildcard attribute scan -- Query Error
5. js/Date or js/Date.now in result-transform -- silently returns nil
6. (between ?b :today :7d-after) -- returned 0 results
7. clj->js in result-transform -- throws error
8. js/console.log in result-transform -- throws error


## SECTION 9: DEBUGGING QUERIES

Dump all refs of a block:
```clojure
{:query [:find ?ref-title
         :where
         [?b :block/title "BLOCK_NAME"]
         [?b :block/refs ?ref]
         [?ref :block/title ?ref-title]]
 :view (fn [result] [:pre (pr-str result)])}
```

Dump full entity data:
```clojure
{:query [:find (pull ?b [*])
         :where [?b :block/title "BLOCK_NAME"]]
 :view (fn [result] [:pre (pr-str (first result))])}
```

Dump a journal page entity:
```clojure
{:query [:find (pull ?p [*])
         :where
         [?p :block/tags ?t]
         [?t :db/ident :logseq.class/Journal]]
 :view (fn [result] [:pre (pr-str (first result))])}
```

Inspect raw property values:
```clojure
{:query [:find (pull ?b [:block/title :logseq.property/scheduled])
         :where
         (task ?b #{"Todo" "Doing"})
         (property ?b :logseq.property/scheduled)]
 :view (fn [result]
         [:pre (pr-str (map :logseq.property/scheduled result))])}
```

Test if result-transform executes:
```clojure
:result-transform (fn [result] [])
```
If results still appear, result-transform is being ignored.

Enable dev tools: Settings, Advanced, Enable Developer Mode. Right-click block to view entity data.
WARNING: Dev tools show materialized attributes that may NOT be queryable in :where clauses.


## Pitfall 4: Multi-value Property Querying

**Problem**: Can't query multi-value properties properly.

**Solution**: Use `contains?` for arrays.

```clojure
;; ❌ WRONG - Direct equality doesn't work for arrays
{:query [:find (pull ?b [*])
         :where
         [?b :logseq.property/collections "Reading List"]]}

;; ✅ CORRECT - Use contains? for multi-value
{:query [:find (pull ?b [*])
         :where
         [?b :logseq.property/collections ?coll]
         [(contains? ?coll "Reading List")]]}
```


## Pitfall 3: Query Tag Matching Issues

**Problem**: Query returns no results even though tagged items exist.

**Cause**: Using `:db/ident` for custom tags instead of `:block/title`.

**Solution**: Always use `:block/title` for tag matching in queries.

```clojure
;; ❌ WRONG - :db/ident only works for built-in tags
{:query [:find (pull ?b [*])
         :where
         [?b :block/tags ?t]
         [?t :db/ident :logseq.class/zot]]}  ;; zot is custom!

;; ✅ CORRECT - :block/title works for all tags
{:query [:find (pull ?b [*])
         :where
         [?b :block/tags ?t]
         [?t :block/title "zot"]]}
```

## Pitfall 9: or Clause Variable Mismatch

**Problem**: Query fails with error: "All clauses in 'or' must use same set of free vars"

**Cause**: Using `or` with branches that have different free variables.

**Error Example**:

```clojure
;; ❌ WRONG - This query fails
{:query [:find (pull ?b [*])
         :where
         (or
           (and [?b :block/tags ?t]
                [?t :block/title "task"])
           (and [?b :block/tags ?child]
                [?child :logseq.property.class/extends ?parent]
                [?parent :block/title "task"]))]}

;; Error: All clauses in 'or' must use same set of free vars,
;; had [#{?b ?t} #{?b ?child ?parent}]
```

**Why This Fails**:
- First branch uses variables: `?b`, `?t`
- Second branch uses variables: `?b`, `?child`, `?parent`
- Standard `or` requires ALL variables to match across branches

**Solution**: Use `or-join` to explicitly declare which variables must unify:

```clojure
;; ✅ CORRECT - Using or-join
{:query [:find (pull ?b [*])
         :where
         (or-join [?b]  ;; Only ?b must match across branches
           (and [?b :block/tags ?t]
                [?t :block/title "task"])
           (and [?b :block/tags ?child]
                [?child :logseq.property.class/extends ?parent]
                [?parent :block/title "task"]))]}
```

**How or-join Works**:
- `(or-join [?b] ...)` means "only `?b` must be the same across all branches"
- Each branch can have its own additional variables
- The final result only includes entities where `?b` matches

**Common Use Case - Tag Inheritance**:

This pattern is essential for querying tag hierarchies where you want blocks tagged with either:
1. The parent tag directly, OR
2. Any child tag that extends the parent
