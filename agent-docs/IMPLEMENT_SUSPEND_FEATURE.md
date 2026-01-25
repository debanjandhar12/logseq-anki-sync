# Renaming overwriteList and Implementing suspend-anki-card Support

## Status: ✅ COMPLETED

## 1. Objective
Rename the existing `overwriteList` setting to `syncOverwriteList` and implement a new feature to control the suspension state of Anki cards via a `suspend-anki-card` property in Logseq.

## 2. Current Situation
- **Settings**: The plugin currently uses `overwriteList` in `src/settings.ts` to determine which fields (Content, Deck, Tags, Suspended) are overwritten during sync.
- **Sync Process**: The sync logic resides mainly in `src/sync/syncLogseqToAnki.ts` and uses various tasks (high-level) which call lower-level LazyAnkiManager operations. It currently lacks a dedicated step for updating suspended unsuspended status based on block properties.
- **Anki Integration**: The `AnkiConnect` wrapper needs methods to support `suspend` and `unsuspend` actions.

## 3. Requirements

### 3.1 Settings Renaming ✅
- **Old Name**: `overwriteList`
- **New Name**: `syncOverwriteList`
- **Goal**: Rename this setting to be more descriptive while preserving its functionality. The setting allows users to select which attributes are overwritten during sync.
- **Status**: COMPLETED - Setting renamed in `src/settings.ts`

### 3.2 `suspend-anki-card` Feature ✅
- **Property Name**: `suspend-anki-card`
- **Type**: Checkbox (Boolean)
- **Logic**:
  - The property determines if the associated Anki cards should be suspended.
  - **Resolution Strategy**:
    - Check the current block.
    - If not present, traverse up the parent blocks.
    - If not present, check page properties.
    - If not present, check parent namespace pages (recursively).
  - **Actions**:
    - **True**: Suspend the cards.
    - **False**: Unsuspend the cards.
    - **Null/Undefined**: Do nothing (preserve existing Anki state).
- **Constraints**:
  - **No Logic in Note.ts**: The `Note` class should **not** contain the logic for resolving this property. It must remain a data holder/bridge.
  - **Batch Processing**: The system should collect all card ids that need suspending and all that need unsuspending, then send two batched commands (one for suspend, one for unsuspend).
- **Status**: COMPLETED - All requirements implemented

## 4. Implementation Plan

### 4.1 Rename Setting ✅
- **File**: `src/settings.ts`
- **Action**: Rename `overwriteList` to `syncOverwriteList`.
- **References**: Update `registerSettingsChangeListener` and any UI logic to use the new key. Update warning messages to reflect the new name if applicable.
- **Status**: COMPLETED

### 4.2 Update Anki Connect Wrapper ✅
- **File**: `src/anki-connect/AnkiConnect.ts`
- **Action**: Add two new methods:
  - `suspend(cards: number[])`: Invokes the `suspend` action.
  - `unsuspend(cards: number[])`: Invokes the `unsuspend` action.
- **Status**: COMPLETED

### 4.3 Create New parser called SuspendUnsuspendPropertyParser.ts ✅
- **File**: `src/sync/parsers/SuspendUnsuspendPropertyParser.ts` (New File)
- **Class**: `SuspendUnsuspendPropertyParser`
- **Method**: `static async parse(note: Note): Promise<boolean | null>`
- **Logic**:
  1. **Block Property**: Check `note.properties["suspend-anki-card"]`. If boolean, return it.
  2. **Parent Block Traversal**:
     - Use `LogseqProxy.Editor.getBlock` to traverse up `note.uuid` parents.
     - Check `suspend-anki-card` on each parent. Return if found.
  3. **Page Property**:
     - Get page using `note.pageId`.
     - Check property on page. Return if found.
  4. **Namespace Traversal**:
     - Use `LogseqProxy.Editor.getParentNamespacePages(page)`.
     - Check property on each namespace parent. Return if found.
  5. **Default**: Return `null` if not found.
- **Status**: COMPLETED - Includes case-insensitive property lookup and value normalization

### 4.4 Add SuspendUnsuspendPropertyParser to NoteParser.ts ❌ (CHANGED)
- **File**: `src/sync/parsers/NoteParser.ts`
- **Action**:
  - Import `SuspendUnsuspendPropertyParser`.
  - In `parseNote` function, call `const shouldSuspend = await SuspendUnsuspendPropertyParser.parse(note);`.
  - Return `shouldSuspend` as the last element of the `ParsedNoteData` tuple.
- **File**: `src/sync/types.ts`
  - Update `ParsedNoteData` type definition to include `shouldSuspend: boolean | null` at index 6.
- **Status**: NOT IMPLEMENTED - Decision made to keep suspend/unsuspend logic separate from main parsing pipeline to avoid affecting hash calculations and note updates

### 4.5 Create New Sync Task ✅
- **File**: `src/sync/tasks/SuspendUnsuspendNotesTask.ts` (New File)
- **Class**: `SuspendUnsuspendNotesTask`
- **Method**: `execute(notes: Note[], ankiNoteManager: LazyAnkiNoteManager, progressNotification: ProgressNotification)`
- **Logic**:
  1. Initialize `cardsToSuspend: number[] = []` and `cardsToUnsuspend: number[] = []`.
  2. Iterate through `notes`.
  3. For each note:
     - Call `SuspendUnsuspendPropertyParser.parse(note)` directly.
     - If `true`: Get Anki Card IDs via `ankiNoteManager` and push to `cardsToSuspend`.
     - If `false`: Get Anki Card IDs and push to `cardsToUnsuspend`.
  4. **Batch Execute**:
     - If `cardsToSuspend` not empty: `await AnkiConnect.suspend(cardsToSuspend)`.
     - If `cardsToUnsuspend` not empty: `await AnkiConnect.unsuspend(cardsToUnsuspend)`.
  5. Specific Log messages for debugging ("Suspending X cards", etc.).
- **Status**: COMPLETED - Task directly uses SuspendUnsuspendPropertyParser without going through NoteParser

### 4.6 Integrate into Sync Workflow ✅
- **File**: `src/sync/syncLogseqToAnki.ts`
- **Action**: In `executeSyncPlan`:
  1. Check `syncOverwriteList` (new setting name) for `"Suspended"`.
  2. If present:
     - Instantiate `SuspendUnsuspendNotesTask`.
     - Execute it passing `[...toCreateNotes, ...toUpdateNotes]`.
     - **Location**: Place this call **after** `deleteNotes` and **before** `updateAssets`.
  3. Manage Progress: Ensure `progressNotification` total count includes this step (allocate ~5% or fixed increment).
- **Status**: COMPLETED

### 4.7 Register Property in Note.ts ✅
- **File**: `src/anki-notes/Note.ts`
- **Action**: Register `suspend-anki-card` property in `initLogseqOperations` method.
- **Code**: `LogseqProxy.Editor.registerProperty("suspend-anki-card", { type: "checkbox", cardinality: "one", hide: false });`
- **Status**: COMPLETED

### 4.8 Create Comprehensive Tests ✅
- **File**: `tests/src/sync/parsers/SuspendUnsuspendPropertyParser.test.ts` (New File)
- **Coverage**:
  - Block-level property (true/false/string values)
  - Parent block inheritance
  - Page property inheritance
  - Block overrides parent/page
  - Case-insensitive property names and values
  - Both File Mode and DB Mode tests
- **Status**: COMPLETED - 22 test cases covering all scenarios

## 5. Architecture Decision

The implementation keeps suspend/unsuspend logic **separate** from the main parsing pipeline:

- **Rationale**: Suspend state is card metadata, not content. Including it in ParsedNoteData would affect hash calculations and trigger unnecessary note updates.
- **Approach**: SuspendUnsuspendNotesTask directly calls SuspendUnsuspendPropertyParser for each note, keeping the logic isolated.
- **Benefits**: 
  - Cleaner separation of concerns
  - No impact on existing hash-based change detection
  - Easier to maintain and test independently

## 6. Testing

All tests pass:
- Type checking: ✅ `npx tsc --noEmit`
- Unit tests: ✅ 95 passed | 51 skipped (146 total)
- New tests: ✅ 22 test cases for SuspendUnsuspendPropertyParser

## 7. Files Modified/Created

### Modified:
- `src/settings.ts` - Renamed overwriteList to syncOverwriteList
- `src/anki-connect/AnkiConnect.ts` - Added suspend/unsuspend methods
- `src/sync/syncLogseqToAnki.ts` - Integrated SuspendUnsuspendNotesTask
- `src/anki-notes/Note.ts` - Registered suspend-anki-card property

### Created:
- `src/sync/parsers/SuspendUnsuspendPropertyParser.ts` - Property resolution logic
- `src/sync/tasks/SuspendUnsuspendNotesTask.ts` - Batch suspend/unsuspend execution
- `tests/src/sync/parsers/SuspendUnsuspendPropertyParser.test.ts` - Comprehensive test suite