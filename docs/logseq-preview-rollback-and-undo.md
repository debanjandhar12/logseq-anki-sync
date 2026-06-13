# Logseq Preview, Rollback, and Undo Research

## Context

The plugin currently uses a fakeable Logseq transaction layer to preview graph mutations before applying them to the real Logseq graph. The preview path executes commands against an in-memory representation, renders a diff for user review, and commits the same command sequence through the Logseq API after approval.

This document investigates simpler alternatives:

- Export the graph, apply real changes, diff, then restore the export if rejected.
- Use SQLite checkpoints or database snapshots to rollback preview changes.
- Reuse Logseq's native undo machinery.
- Avoid polluting or generating Logseq undo history for plugin changes.

The findings below are based on the bundled Logseq source under `logseq-source/`.

## Relevant Logseq Source Files

- `logseq-source/src/main/logseq/api.cljs`
- `logseq-source/src/main/logseq/api/editor.cljs`
- `logseq-source/src/main/logseq/api/block.cljs`
- `logseq-source/src/main/logseq/api/db_based.cljs`
- `logseq-source/src/main/logseq/api/db_based/cli.cljs`
- `logseq-source/src/main/frontend/modules/outliner/ui.cljc`
- `logseq-source/src/main/frontend/modules/outliner/op.cljs`
- `logseq-source/src/main/frontend/db/transact.cljs`
- `logseq-source/src/main/frontend/worker/db_core.cljs`
- `logseq-source/src/main/frontend/worker/sync/apply_txs.cljs`
- `logseq-source/src/main/frontend/worker/undo_redo.cljs`
- `logseq-source/deps/db/src/logseq/db/sqlite/export.cljs`
- `logseq-source/deps/outliner/src/logseq/outliner/op/construct.cljc`

## Approach 1: `logseq.api.export_edn` and `logseq.api.import_edn`

### How It Works

`logseq.api.export_edn` and `logseq.api.import_edn` are exported from `logseq.api.cljs`:

```clojure
(def ^:export import_edn (ensure-db-graph cli-based-api/import-edn))
(def ^:export export_edn (ensure-db-graph cli-based-api/export-edn))
```

Both APIs are guarded by `ensure-db-graph`, so they only work for DB-based Logseq graphs.

`export_edn` defaults to `{:export-type :graph}`. In `logseq.db.sqlite.export/build-export`, `:graph` uses the datom export path:

```clojure
:graph
(build-graph-datoms-export db)
```

The datom export contains `::graph-format :datoms` and a sorted set of exported datoms.

Importing a datom export uses `build-datom-import`:

```clojure
(defn- build-datom-import
  [export-map db]
  {:init-tx (into (current-db-retract-tx db)
                  (map (fn [[e a v]] [:db/add e a v]))
                  (datoms-for-import (:datoms export-map)))
   :block-props-tx []
   :misc-tx []})
```

`current-db-retract-tx` retracts every current entity before adding the exported datoms:

```clojure
(defn- current-db-retract-tx
  [db]
  (->> (d/datoms db :eavt)
       (map :e)
       distinct
       (mapv (fn [e] [:db/retractEntity e]))))
```

So a full graph datom import is closer to replacement than a normal merge import.

### Possible Preview Flow

1. Call `logseq.api.export_edn({ exportType: "graph" })`.
2. Apply proposed changes through normal Logseq plugin APIs.
3. Read affected pages and render the diff.
4. If rejected, call `logseq.api.import_edn(originalExport)`.
5. If approved, either keep the already-applied changes or revert and reapply them depending on the desired review flow.

### Feasibility

This is technically possible only for DB graphs.

However, it is not a safe default preview strategy because it mutates the real graph before approval and relies on a whole-graph replacement transaction to recover.

### Concerns

- It does not work for file-based Markdown graphs.
- Preview changes are real changes. They can trigger persistence, sync, indexing, plugin listeners, UI refreshes, and other side effects.
- Reverting via `import_edn` is also a real graph mutation and creates another transaction.
- User edits or sync changes that happen between export and revert can be lost.
- For large graphs, full graph export/import can be slow and memory-heavy.
- Datom export intentionally excludes some local/runtime data, including several graph KV values and attributes such as embedding metadata, local graph identifiers, and user metadata.
- If restore fails, the graph remains modified.
- Keeping preview changes after approval pollutes user undo history with the preview transaction. Reverting and reapplying pollutes history with preview, restore, and final apply transactions.
- The approach makes review correctness depend on whole-graph backup/restore semantics instead of on a pure preview model.

### Verdict

Do not use `export_edn` and `import_edn` as the normal preview rollback mechanism.

It may be useful as a developer recovery tool or a last-resort safety backup before applying a large approved change, but it should not be used for speculative preview mutations on the real graph.

## Approach 2: SQLite Checkpoints or Database Snapshots

### What Exists in Logseq

Logseq has worker APIs for SQLite export/import and backup:

```clojure
:thread-api/backup-db-sqlite
:thread-api/import-db-binary
```

`backup-db-sqlite` checkpoints the DB and asks the platform SQLite layer to write a backup file:

```clojure
(checkpoint-db! repo db)
(p/let [_ (backup-db-fn db dst-path)]
  {:path dst-path})
```

`import-db-binary` closes the DB, imports the binary database, and restarts it:

```clojure
(p/let [_ (close-db! repo)
        pool (<get-opfs-pool repo)
        _ (<import-db pool data)
        _ (start-db! repo {:import-type :sqlite-db})]
  nil)
```

The CLI backup/restore commands use these internal thread APIs.

### Why SQLite Checkpoints Do Not Solve Preview Rollback

SQLite checkpointing usually means WAL checkpointing: flushing WAL content into the main database file. It is not a reversible checkpoint or savepoint.

SQLite savepoints would only help if all preview mutations could run inside one uncommitted SQLite transaction on the same SQLite connection, with Logseq prevented from committing or broadcasting side effects. Plugin APIs do not expose that level of control. Logseq's editor/plugin APIs go through the outliner transaction pipeline and persist transactions normally.

### Feasibility

Database binary backup/import is conceptually possible inside Logseq internals, but it is not a stable public plugin API. Restoring a binary database requires closing/restarting the database and is too disruptive for a normal review UI.

### Concerns

- These are internal db-worker/CLI APIs, not normal plugin APIs.
- Restore is whole-database replacement.
- Restore requires closing and restarting graph state.
- Preview mutations still happen on the real graph before approval.
- Side effects can still fire before restore.
- Sync/user edit races still exist.
- This is heavier and more invasive than EDN restore.

### Verdict

Do not use SQLite checkpoints or SQLite backup/import as the preview rollback mechanism from a plugin.

## Logseq Native Undo Flow

Logseq has a dedicated worker-side undo/redo subsystem in `frontend.worker.undo-redo`.

### Plugin Mutation Flow

Most plugin-visible graph mutations route through the same path as UI edits.

Example flow for block/property mutations:

1. Plugin calls an exported API from `logseq.api`, such as `insert_block`, `update_block`, `remove_block`, `upsert_block_property`, or DB graph property/tag APIs.
2. The API implementation calls editor/page/property handlers or `logseq.api.db-based` helpers.
3. Those helpers call `frontend.modules.outliner.ui/transact!` or functions that eventually do.
4. `ui/transact!` binds `frontend.modules.outliner.op/*outliner-ops*` and records semantic outliner ops generated by `frontend.modules.outliner.op`.
5. `ui/transact!` calls `frontend.db.transact/apply-outliner-ops`.
6. `apply-outliner-ops` ensures a local transaction id and marks metadata with `:local-tx? true`.
7. `apply-outliner-ops` sends `:thread-api/apply-outliner-ops` to the DB worker.
8. The DB worker calls `logseq.outliner.op/apply-ops!`.
9. Persistence/sync code processes the tx report and calls `frontend.worker.undo-redo/gen-undo-ops!`.

The key macro is `frontend.modules.outliner.ui/transact!`:

```clojure
(defmacro transact!
  [opts & body]
  `(let [ops# frontend.modules.outliner.op/*outliner-ops*
         editor-info# (frontend.state/get-editor-info)]
     (reset! frontend.state/*editor-info editor-info#)
     (if ops#
       (do ~@body)
       (binding [frontend.modules.outliner.op/*outliner-ops* (transient [])]
         ~@body
         (let [r# (persistent! frontend.modules.outliner.op/*outliner-ops*)]
           (frontend.db.transact/apply-outliner-ops
            (frontend.db.conn/get-db false)
            r#
            ~opts))))))
```

`frontend.db.transact/apply-outliner-ops` then sets local transaction metadata:

```clojure
(let [opts' (-> opts
                ensure-local-op-tx-id
                (assoc
                 :client-id (:client-id @state/state)
                 :local-tx? true))]
  ...)
```

### Undo Stack Generation

`frontend.worker.undo-redo/gen-undo-ops!` creates undo stack entries when all of these are true:

```clojure
(true? local-tx?)
outliner-op
(not (false? (:gen-undo-ops? tx-meta)))
(not (:create-today-journal? tx-meta))
(not (contains? #{:create-view} (:source-outliner-op tx-meta)))
```

The generated history data includes:

- `:db-sync/tx-id`
- `:tx-meta`
- `:added-ids`
- `:retracted-ids`
- `:db-sync/forward-outliner-ops`
- `:db-sync/inverse-outliner-ops`

The undo stack is held in worker atoms:

```clojure
(defonce *undo-ops (atom {}))
(defonce *redo-ops (atom {}))
```

### Semantic Forward and Inverse Ops

Logseq prefers semantic outliner ops over raw tx reversal. Supported semantic ops are listed in `logseq.outliner.op.construct/semantic-outliner-ops`:

```clojure
#{:save-block
  :insert-blocks
  :apply-template
  :move-blocks
  :move-blocks-up-down
  :indent-outdent-blocks
  :delete-blocks
  :create-page
  :rename-page
  :delete-page
  :restore-recycled
  :recycle-delete-permanently
  :upsert-property}
```

`derive-history-outliner-ops` canonicalizes forward ops from transaction metadata and builds inverse ops from `db-before`, `db-after`, and `tx-data`:

```clojure
(defn derive-history-outliner-ops
  [db-before db-after tx-data tx-meta]
  ...
  {:forward-outliner-ops forward-outliner-ops
   :inverse-outliner-ops inverse-outliner-ops})
```

If semantic inverse ops cannot be built, Logseq can fall back to stored reversed tx data for some history actions.

### Undo Execution

The UI handler calls worker thread APIs:

```clojure
:thread-api/undo-redo-undo
:thread-api/undo-redo-redo
```

`frontend.worker.undo-redo/undo` pops the last undo op and applies the inverse through `apply-history-action!`.

Undo/redo actions mark their own tx metadata with:

```clojure
:gen-undo-ops? false
:persist-op? true
:undo? true
:redo? false
```

This prevents undo itself from generating another undo entry.

### Public API Status

The exported plugin API in `logseq.api.cljs` does not expose `undo` or `redo` functions. Undo is wired through Logseq UI handlers and internal db-worker thread APIs.

Plugin operations are undoable because they enter the same transaction pipeline, not because plugins call an undo API directly.

## Can Plugin Operations Avoid Logseq Undo History?

This question matters if the plugin changes design from pure in-memory preview to real Logseq mutations plus plugin-managed reverse operations. In that design, native Ctrl+Z becomes dangerous because the user could undo the same changes through Logseq while the plugin also believes it owns the reverse operation stack.

The ideal requirement would be:

- Apply approved plugin mutations to the real graph.
- Do not add those mutations to Logseq's native undo stack.
- Keep plugin-managed reverse operations as the only rollback path for that change batch.

Logseq has an internal mechanism for this, but the public plugin API does not expose it consistently.

### Internal Mechanism Exists

Logseq supports an internal transaction metadata flag:

```clojure
:gen-undo-ops? false
```

When this flag is present in tx metadata, `frontend.worker.undo-redo/gen-undo-ops!` does not add an undo stack entry.

This is used internally for undo/redo actions and sync-related operations.

### Public Plugin APIs Do Not Expose It

The exported plugin API wrappers do not appear to expose a stable option for setting `:gen-undo-ops? false`.

Examples:

- `logseq.api.editor/insert_block` accepts options such as `before`, `start`, `end`, `sibling`, `customUUID`, `properties`, `autoOrderedList`, and `schema`. It does not forward a skip-undo option to tx metadata.
- `logseq.api.editor/update_block` forwards block-level options to save logic, but there is no public tx metadata option for `:gen-undo-ops?`.
- `logseq.api.block/db-based-save-block-properties!` wraps property changes with `ui-outliner-tx/transact! {:outliner-op :set-block-properties}` and does not expose skip undo metadata.
- `logseq.api.db-based/cli/import-edn` wraps imports with `ui-outliner-tx/transact! {:outliner-op :batch-import-edn}` and does not expose skip undo metadata.

The TypeScript SDK types also do not expose a skip-undo option. For example, `libs/src/LSPlugin.ts` types `updateBlock` as:

```ts
updateBlock: (
  srcBlock: BlockIdentity | EntityID,
  content: string,
  opts?: Partial<{ properties: {} }>
) => Promise<void>
```

and `insertBlock` as:

```ts
insertBlock: (
  srcBlock: BlockIdentity | EntityID,
  content: string,
  opts?: Partial<{
    before: boolean
    sibling: boolean
    start: boolean
    end: boolean
    customUUID: string
    properties: {}
  }>
) => Promise<BlockEntity | null>
```

There is no typed `skipUndo`, `genUndoOps`, or transaction metadata option.

### Accidental `updateBlock` Loophole

There is one narrow, undocumented loophole in the current Logseq implementation.

`logseq.api.editor/update_block` converts the JS options object with `bean/->clj` and passes it into `db-based-api/update-block`:

```clojure
(def update_block
  (fn [id content ^js opts]
    (this-as
     this
     (p/let [block (<get-block id {:children? false})
             opts' (bean/->clj opts)]
       (when block
         (db-based-api/update-block this block content opts'))))))
```

`db-based-api/update-block` then forwards most of those options into `editor-handler/save-block!`:

```clojure
(editor-handler/save-block! repo
                            (sdk-utils/uuid-or-throw-error block-uuid) content
                            (dissoc opts :properties))
```

`editor-handler/save-block!` eventually reaches `save-block-inner!`, which merges the options into transaction metadata by adding `:outliner-op :save-block`:

```clojure
(let [opts' (assoc opts :outliner-op :save-block)]
  (ui-outliner-tx/transact!
   opts'
   (outliner-save-block! block')))
```

Because `:gen-undo-ops? false` is checked directly from tx metadata, an exact Clojure keyword key might suppress undo for `updateBlock` if it can be smuggled through the JS options object.

For example, a plugin might try something like this:

```ts
await logseq.Editor.updateBlock(blockUuid, content, {
  // Undocumented and type-unsafe. Depends on cljs-bean key conversion.
  ["gen-undo-ops?"]: false,
} as any);
```

This is not a supported API and should not be used as an architectural dependency.

Reasons:

- It only appears to apply to `updateBlock`/save-block style paths where arbitrary options are preserved into tx metadata.
- `insertBlock` reconstructs its own option map and wraps insertion with hard-coded `{:outliner-op :insert-blocks}`.
- `removeBlock` calls `delete-block-aux!`, which hard-codes `{:outliner-op :delete-blocks}`.
- `moveBlock` calls move handlers that hard-code `{:outliner-op :move-blocks}`.
- Property, tag, page, EDN import, and many DB graph APIs hard-code their transaction metadata.
- It depends on implementation details of `cljs-bean/->clj` and internal tx metadata names.
- The SDK types do not document or allow it.
- Logseq could sanitize options or stop forwarding arbitrary keys in any release.

So this loophole may be useful for a quick local experiment, but it is not a reliable solution for preventing Ctrl+Z after plugin-managed commits.

### Possible but Unsupported Routes

There are internal routes that could theoretically bypass or control undo history:

1. Call internal worker APIs directly with custom tx metadata.
2. Use `frontend.db.transact/transact` or `frontend.db.transact/apply-outliner-ops` with metadata including `:gen-undo-ops? false`.
3. Call lower-level `ldb/transact!` or worker transaction functions without `:local-tx? true` or without `:outliner-op`.
4. Clear the undo stack with internal `:thread-api/undo-redo-clear-history` after plugin changes.

These are not good plugin design choices.

Problems:

- They are internal implementation details, not stable plugin APIs.
- They may be unavailable from the plugin sandbox.
- They can break sync, persistence, validation, or UI refresh expectations.
- Clearing undo history is hostile to the user because it removes unrelated user undo entries.
- Bypassing semantic outliner ops can make changes less robust across Logseq versions.

### Verdict on Preventing Undo

For normal public plugin APIs, there is no supported, general way to prevent Logseq from recording undo history for graph mutations.

Internally, `:gen-undo-ops? false` is the switch, but the plugin API does not expose it as a stable option. Relying on internal worker APIs, undocumented option passthrough, or clearing history should be avoided.

If preventing Ctrl+Z is a hard requirement, the clean fix would need to be upstream in Logseq: add an explicit plugin API option such as `skipUndo` or `recordUndo: false`, and have editor/property/page APIs intentionally propagate it as `:gen-undo-ops? false` in transaction metadata.

Without an upstream API, plugin-managed reverse operations must assume Logseq native undo entries will still exist.

## Using Native Undo as Preview Rollback

Native undo is tempting because plugin ops are already undoable.

Potential flow:

1. Apply preview changes through public plugin APIs.
2. Read changed pages and render diff.
3. If rejected, invoke native undo for the generated operations.
4. If approved, keep the changes.

This is not recommended.

Concerns:

- There is no public plugin undo API.
- The plugin must know exactly how many undo entries were created.
- A logical plugin operation may create multiple Logseq undo entries.
- User edits during the preview window can interleave with plugin undo entries.
- Undo persists/syncs new transactions.
- Keeping preview changes after approval leaves preview operations in the user's undo stack.
- Reverting and reapplying pollutes history even more.
- Programmatic use of internal undo APIs could break across Logseq versions.

Native undo is valuable as a model for plugin-side architecture, but not as the rollback engine for speculative previews.

## Recommended Direction

Avoid mutating the real graph for preview.

The safest simpler design is a reduced semantic operation model:

1. Build a high-level list of intended operations.
2. Capture before snapshots for only affected pages/blocks.
3. Project those operations onto a lightweight affected-page representation for preview.
4. Render the diff from before/after snapshots.
5. On approval, apply the high-level operations through public Logseq APIs.
6. Optionally store plugin-side inverse metadata for failure recovery, but do not try to be a general Logseq undo engine.

This borrows the useful part of Logseq's design: forward semantic ops plus inverse semantic ops. It avoids the risky part: applying speculative changes to the user's actual graph and trying to clean them up afterward.

## Practical Conclusions

- `export_edn` / `import_edn` can replace DB graph state in theory, but is too risky for preview rollback.
- SQLite checkpoints are not rollback points, and SQLite backup/import is too internal and disruptive.
- Logseq records undo for plugin operations because public APIs flow through `ui/transact!`, worker apply ops, persistence/sync, and `gen-undo-ops!`.
- The internal way to prevent undo history is `:gen-undo-ops? false` in tx metadata.
- Public plugin APIs do not expose a supported skip-undo option.
- Native undo should not be used as the plugin's speculative preview rollback mechanism.
- The best path is a smaller operation projection layer focused only on affected pages/blocks, not a full Logseq in-memory executor.
