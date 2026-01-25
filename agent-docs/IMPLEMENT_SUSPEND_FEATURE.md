# Renaming overwriteList and Implementing suspend-anki-card Support

## 1. Objective
Rename the existing `overwriteList` setting to `syncOverwriteList` and implement a new feature to control the suspension state of Anki cards via a `suspend-anki-card` property in Logseq.

## 2. Current Situation
- **Settings**: The plugin currently uses `overwriteList` in `src/settings.ts` to determine which fields (Content, Deck, Tags, Suspended) are overwritten during sync.
- **Sync Process**: The sync logic resides mainly in `src/sync/syncLogseqToAnki.ts` and uses various operations. It currently lacks a dedicated step for updating suspension status based on block properties.
- **Anki Integration**: The `AnkiConnect` wrapper needs methods to support `suspend` and `unsuspend` actions.

## 3. Requirements

### 3.1 Settings Renaming
- **Old Name**: `overwriteList`
- **New Name**: `syncOverwriteList`
- **Goal**: Rename this setting to be more descriptive while preserving its functionality. The setting allows users to select which attributes are overwritten during sync.

### 3.2 `suspend-anki-card` Feature
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

## 4. Implementation Plan

### 4.1 Rename Setting
- **File**: `src/settings.ts`
- **Action**: Rename `overwriteList` to `syncOverwriteList`.
- **References**: Update `registerSettingsChangeListener` and any UI logic to use the new key. Update warning messages to reflect the new name if applicable.

### 4.2 Update Anki Connect Wrapper
- **File**: `src/anki-connect/AnkiConnect.ts`
- **Action**: Add two new methods:
  - `suspend(cards: number[])`: Invokes the `suspend` action.
  - `unsuspend(cards: number[])`: Invokes the `unsuspend` action.

### 4.3 Create New Sync Task
- **File**: `src/sync/tasks/SuspendUnsuspendNotesTask.ts` (New File)
- **Goal**: Handle the logic for property resolution and suspension updates.
- **Architecture**:
  - Create a class `SuspendNotesOperation`.
  - Implement an `execute` method that accepts the list of notes and `ankiNoteManager`.
  - **Property Resolution Helper**: Implement a standalone or private helper function within this file (NOT in `Note.ts`) to traverse the block/page hierarchy and resolve the `suspend-anki-card` value for a given note.
  - **Execution Flow**:
    1. Initialize empty arrays: `cardsToSuspend` and `cardsToUnsuspend`.
    2. Iterate through all valid notes.
    3. For each note, resolve the suspend property.
    4. If a value is found (true/false), retrieve the corresponding Anki Card IDs.
    5. Add IDs to the respective array.
    6. Call `AnkiConnect.suspend(cardsToSuspend)`.
    7. Call `AnkiConnect.unsuspend(cardsToUnsuspend)`.

### 4.4 Integrate into Sync Workflow
- **File**: `src/sync/syncLogseqToAnki.ts`
- **Action**: Check `syncOverwriteList` for the "Suspended" option.
- **Integration**: If enabled, instantiate and execute `SuspendUnsuspendNotesTask` after delete task and before asset. Allocate 5% of progress for this task.

### 4.5 Register Property
- **File**: `src/anki-notes/Note.ts`
- **Action**: Register `suspend-anki-card` in `initLogseqOperations` solely for Logseq UI integration (making it a selectable property), without adding business logic to the class.
