# Implementation Plan: Migrating from Page Names to Page IDs

## 1. Executive Summary

This document outlines the plan to refactor the Logseq Anki Sync plugin to use page IDs instead of page names as primary identifiers for pages. In file-based versions of Logseq, page names were unique. However, in modern database-backed versions, only page IDs are guaranteed to be unique. The current implementation's reliance on page names can lead to incorrect page lookups and data corruption when multiple pages share the same name. This migration is critical for ensuring the plugin's reliability and compatibility with current and future versions of Logseq.

## 2. Problem Analysis & Key Issues

*   **Lack of Uniqueness:** In Logseq's database mode, multiple pages can have the same name. The Logseq API `getPage(<name>)` will only return the *first* match, which can be unpredictable and lead to the wrong page's data being used.
*   **Data Integrity Risks:** Operations like calculating note hashes, determining deck names from namespaces, and fetching page content can all fail or use incorrect data if they rely on a non-unique page name. This compromises the core functionality of the sync process.
*   **Affected Components:** The issue is widespread and affects critical parts of the codebase, including:
    *   `Note.ts`: Where the `page` property is stored.
    *   `NoteHashCalculator.ts`: Which uses page information for hash calculation.
    *   `DeckParser.ts`: Which resolves deck names based on page hierarchy.
    *   `LogseqProxy.ts` & `LogseqPropertiesHelper.ts`: The core wrappers around the Logseq API.
    *   `BlockAndPageHashCache.ts`: Caching mechanism that uses page names as keys.

## 3. Proposed Solution Strategy

The migration will be executed in three phases to ensure a structured and low-risk transition. The core idea is to transition from passing page names (`string`) to passing page IDs (`number`) for all page-related operations.

### Phase 1: Core Data Structure & API Adaptation

**Objective:** Update the `Note` class to store the page ID and modify low-level Logseq API wrappers to prioritize ID-based fetching.

1.  **Modify `Note.ts`:**
    *   Replace the `page: PageEntity` property with `pageId: number`. This is a breaking change within the plugin's data model.
    *   Any logic that previously accessed `note.page` will need to be refactored to fetch the page entity using `note.pageId` when necessary. This promotes a cleaner separation of concerns, where the `Note` object holds the identifier, and services are responsible for fetching the full entity.
2.  **Update `LogseqProxy.ts` and `LogseqPropertiesHelper.ts`:**
    *   The goal is to internally shift all page lookups to use page IDs.
    *   Existing methods that accept page names will be kept for now to minimize breaking changes in the short term, but their internal implementation should be updated to resolve the page name to a page ID as early as possible.
    *   A warning should be logged when a name-based lookup is used, to help identify areas that still need refactoring.

### Phase 2: Refactor Dependent Services and Parsers

**Objective:** Update all services that consume page data to use page IDs.

1.  **`NoteHashCalculator.ts`:**
    *   Update logic to use `note.pageId` to fetch page details for hashing, ensuring the hash is based on a unique identifier.
2.  **`DeckParser.ts`:**
    *   Refactor `findDeckInNamespaceHierarchy` and `getDefaultDeck` to operate using `note.pageId`. This involves fetching the page entity via its ID and then traversing its namespace hierarchy.
3.  **`BlockAndPageHashCache.ts`:**
    *   Change the caching key for pages from `pageName` to `pageId`. The functions `addPageNode` and `getPageHash` will need to be updated to accept `pageId`.
4.  **Other Components:**
    *   Review and refactor `LogseqToHtmlConverter.ts` and any other component identified in the initial search that relies on page names for lookups.
    *   **`PreviewInAnki.ts`:** This component currently receives a page name from a Logseq event handler. It may not be possible to switch this to a page ID without changes to how the event is triggered or by performing a lookup. This will be investigated, but a full fix might be out of scope for the initial refactoring. A note will be added to the code to highlight this dependency.

### Phase 3: Data Source and Instantiation

**Objective:** Modify the initial creation of `Note` objects to correctly capture the page ID.

1.  **`syncLogseqToAnki.ts` (or equivalent entry point):**
    *   When processing blocks to create `Note` objects, ensure that the `page.id` from the block's parent page is captured and stored in `note.pageId`.
    *   The initial block processing logic (e.g., `logseq.DB.onBlockChanged`) provides the block entity, which contains `block.page.id`. This is the source of truth for the page ID.

### Phase 4: TypeScript Validation

**Objective:** Use the TypeScript compiler to ensure all type-related changes have been propagated correctly.

1.  **Run TypeScript Compiler:**
    *   After refactoring `Note.ts` to remove `page: PageEntity`, the TypeScript compiler (`tsc`) will be run.
    *   This will generate a list of errors in every location where the old `note.page` property was accessed.
    *   This list of errors will serve as a to-do list, guiding the developer to every single point in the codebase that needs to be updated to use `note.pageId`. This provides a systematic way to ensure no part of the code is missed.

## 4. Implementation Checklist

-   [ ] **Phase 1: Core Data Structure & API Adaptation**
    -   [ ] Replace `page: PageEntity` with `pageId: number` in `Note.ts`.
    -   [ ] Update `Note` constructor and factory methods to handle `pageId`.
    -   [ ] Update internal implementations of `LogseqProxy` and `LogseqPropertiesHelper` to prioritize ID-based lookups and log warnings for name-based lookups.
-   [ ] **Phase 2: Refactor Dependent Services**
    -   [ ] Update `NoteHashCalculator.ts` to use `note.pageId`.
    -   [ ] Update `DeckParser.ts` to use `note.pageId`.
    -   [ ] Update `BlockAndPageHashCache.ts` to use `pageId` as cache keys.
    -   [ ] Investigate and document limitations for `PreviewInAnki.ts`.
-   [ ] **Phase 3: Data Source and Instantiation**
    -   [ ] Modify `syncLogseqToAnki.ts` to correctly extract `block.page.id` when creating `Note` instances.
-   [ ] **Phase 4: TypeScript Validation**
    -   [ ] Run `tsc` to find all compilation errors after changing `Note.ts`.
    -   [ ] Fix all TypeScript errors related to the removal of `note.page`.
-   [ ] **Phase 5: Testing and Validation**
    -   [ ] Write unit tests for the refactored methods to verify ID-based logic.
    -   [ ] Create a test scenario in a DB-based graph with two pages having the same name.
    -   [ ] Run end-to-end tests to confirm that sync operations for both same-named pages work correctly and do not interfere with each other.
-   [ ] **Phase 6: Documentation**
    -   [ ] Update this document with any changes during implementation.
    -   [ ] Add notes to `AGENTS.md` or other development docs regarding the new pattern of using page IDs.

## 5. Blockers & Risks

*   **Existing `Note` objects:** If `Note` objects are serialized or stored somewhere, a migration path for them will be needed to include the `pageId`. (Based on the code, it seems they are generated in-memory during sync, so this risk is low).
*   **Logseq API Behavior:** The plan relies on `block.page.id` being consistently available. Any changes in the Logseq API could affect the data source.
*   **Incomplete Refactoring:** Missing even one instance of a page name lookup could lead to subtle bugs. A thorough search and replacement is critical.

## 6. Next Steps

1.  **Review this document** with the project owner.
2.  **Create a dedicated git branch** for this refactoring task.
3.  **Implement the changes** following the phased approach.
4.  **Commit frequently** with clear messages referencing the tasks in the checklist.
5.  **Perform thorough testing** as described in the testing strategy.
6.  **Submit a pull request** for review.