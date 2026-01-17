# Logseq DB Version Compatibility - Namespace Refactoring

## Issue Summary
The Logseq DB version introduces structural changes to how pages and namespaces are represented, breaking existing logic in `logseq-anki-sync`.

1.  **Page Names**: In the DB version, `page.name` contains only the leaf name (e.g., "Japan"), whereas the file-based version included the full namespace path (e.g., "Geography/Japan").
2.  **Hierarchy**: The parent relationship is now stored in `page.parent` (ID), replacing `page.namespace.id`.
3.  **Broken APIs**: `logseq.Editor.getPagesFromNamespace` and `logseq.Editor.getPagesTreeFromNamespace` are not supported in the DB version.

## Affected Components
-   `utils.ts`: `splitNamespace` is no longer reliable or necessary for DB pages.
-   `DeckParser.ts`: Relies on `page.namespace` to traverse hierarchy for deck inference.
-   `TagParser.ts`: Relies on `page.namespace` to traverse hierarchy for tag inheritance.
-   `ExtraFieldParser.ts`: Relies on `page.properties` which might need namespace validation.
-   `NoteHashCalculator.ts`: Traverses namespace to calculate hash dependencies.
-   `PreviewInAnki.ts`: Uses `getPagesFromNamespace` to find cards in the current namespace.
-   `Note.ts`: Checks `disable-anki-sync` property up the namespace chain.

## Implementation Plan

### 1. Create `LogseqNamespaceHelper`
A new helper class in `src/logseq/LogseqNamespaceHelper.ts` will abstract namespace operations, handling both file-based and DB-based logic.

**Proposed Methods:**

*   `getParentPage(page: PageEntity): Promise<PageEntity | null>`:
    *   Checks `page.parent` (DB) first.
    *   Falls back to `page.namespace` (File).
    *   Returns the parent page object or null.

*   `getFullPageName(page: PageEntity): Promise<string>`:
    *   Recursively constructs the full slash-separated page name by traversing parents using `getParentPage`.
    *   Should handle caching to avoid excessive API calls.

*   `getParentNamespacePages(page: PageEntity): Promise<PageEntity[]>`:
    *   Returns an array of all ancestor pages (the namespace chain).
    *   Implemented via iterative calls to `getParentPage`.

### 2. Refactor Components

#### `DeckParser.ts`
-   Replace `findDeckInNamespaceHierarchy` logic with `LogseqNamespaceHelper.getParentNamespacePages`.
-   Iterate through the returned ancestors to find the `deck` property.
-   Use `LogseqNamespaceHelper.getFullPageName` if the deck is derived from the page name.

#### `TagParser.ts`
-   Replace `collectTagsFromNamespaceHierarchy` logic with `LogseqNamespaceHelper.getParentNamespacePages`.
-   Collect headers/tags from all ancestors.

#### `NoteHashCalculator.ts`
-   Use `LogseqNamespaceHelper.getParentNamespacePages` to gather dependencies for hashing.
-   Ensure the hash includes the full page name (via `getFullPageName`) to maintain consistency.

#### `Note.ts`
-   Update `removeUnwantedNotes` to use `LogseqNamespaceHelper.getParentNamespacePages` when checking for `disable-anki-sync`.

#### `PreviewInAnki.ts`
-   **Problem**: `logseq.Editor.getPagesFromNamespace` (getting *descendants*) is broken.
-   **Solution**: Investigate a DataScript query replacement or a recursive child-fetch method if possible. For now, flag this as requiring a specific fix, possibly a new method in `LogseqNamespaceHelper` (e.g., `getNamespaceChildren`).

#### `utils.ts`
-   Remove `splitNamespace` as it assumes slash-separated strings which are no longer the primary source of truth for hierarchy.

## Todos

-   [ ] Create `src/logseq/LogseqNamespaceHelper.ts`.
-   [ ] Implement `getParentPage`, `getFullPageName`, `getParentNamespacePages`.
-   [ ] Refactor `DeckParser.ts`.
-   [ ] Refactor `TagParser.ts`.
-   [ ] Refactor `NoteHashCalculator.ts`.
-   [ ] Refactor `Note.ts`.
-   [ ] Remove `splitNamespace` from `utils.ts` and update usages.
-   [ ] Investigate and fix `PreviewInAnki.ts` (`getPagesFromNamespace` replacement).
