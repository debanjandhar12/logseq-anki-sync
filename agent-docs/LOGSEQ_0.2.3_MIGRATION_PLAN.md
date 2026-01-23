# Migration Plan for @logseq/libs ^0.2.3

## Executive Summary

The upgrade to `@logseq/libs ^0.2.3` introduces **18 type errors** across the codebase. These errors stem from breaking changes in the API, primarily around:
1. Removal of `properties` field from `BlockEntity` and `PageEntity` objects returned by API calls
2. Property namespacing: plugin properties now prefixed with `plugin.property.<plugin_id>.<property_name>`
3. Stricter type checking for API parameters
4. New database graph APIs for querying properties and tags separately

## Key Updates to Migration Plan

This document has been updated to incorporate the following critical points:

### 1. Property Prefix Stripping
**Issue:** Properties returned from `getBlockProperties()` and `getPageProperties()` are now namespaced with prefixes. The actual format discovered is `:user.property/deck-bavZ5684` (not `plugin.property.*` as initially expected). Simply assigning these properties breaks backward compatibility.

**Solution:** Implemented `stripPropertyPrefixes()` function that:
- Extracts property names from `:user.property/name-suffix` format (e.g., `:user.property/deck-bavZ5684` → `deck`)
- Filters out system properties (`:logseq.property.*`) but keeps `:block/tags`
- Handles `:block/property` format by extracting after `/` (e.g., `:block/tags` → `tags`)
- Prefers non-prefixed properties in case of conflicts
- Maintains backward compatibility with code expecting unprefixed property names

**Note on Tags:**
- `block.tags` (top level) contains ID references: `[{id: 141}]`
- `properties[":block/tags"]` contains tag name strings: `["Card"]`
- After stripping, tags remain in `properties.tags` for easy access

**Actual Block Structure After Processing:**
```json
// Input from getBlockProperties()
{
    ":logseq.property.embedding/hnsw-label-updated-at": 0,
    ":block/tags": ["Card"],
    ":user.property/deck-bavZ5684": "Testx"
}

// Output after stripping (in block.properties)
{
    "tags": ["Card"],
    "deck": "Testx"
}
```
(System properties filtered, prefixes stripped)

**Usage Example:**
```typescript
import { LogseqPropertiesHelper } from "../logseq/logseqPropertiesHelper";

const block = await LogseqPropertiesHelper.getBlock(uuid);
console.log(block.properties.deck);  // "Testx"
console.log(block.properties.tags);  // ["Card"]
```

### 2. Helper Method Pattern for Property Access
**Issue:** Some places in the codebase intentionally bypass LogseqProxy cache to avoid stale data (e.g., ImageOcclusionNote.ts). These need properties but can't use cached calls.

**Solution:** Created separate helper methods (`logseqPropertiesHelper`, `getPageWithProperties`) that:
- Provide non-cached, fresh data with properties attached
- Can be called directly when cache bypass is needed
- Are used internally by LogseqProxy for cached access
- Separate concerns: low-level property fetching vs. caching layer

### 3. Locations Requiring Updates
**Direct API calls identified:**
- `ImageOcclusionNote.ts`: 3 locations bypassing cache (lines 67, 239, 268)
- `LogseqAnkiFeatureExplorer.tsx`: 19 locations (13 getBlock, 6 getPage calls)
- All must switch from `logseq.Editor.getBlock/getPage()` to helper methods

**Rationale for direct calls:**
- UI components need fresh data for user interactions
- Image occlusion editor needs current block state
- Caching would cause stale data bugs in these contexts

## Breaking Changes Documented

### 1. Properties/Tags Removal from Block and Page Entities
**Impact:** HIGH  
**Source:** User-provided information

- `BlockEntity.properties` is now optional (`properties?: Record<string, any>`)
- `PageEntity.properties` is now optional (`properties?: Record<string, any>`)
- Properties and tags are NO LONGER automatically included in `getBlock()` and `getPage()` responses
- New APIs added for explicit property retrieval:
  - `Editor.getBlockProperties(block: BlockIdentity): Promise<Record<string, any> | null>`
  - `Editor.getPageProperties(page: PageIdentity): Promise<Record<string, any> | null>`
  - `Editor.getAllTags(): Promise<PageEntity[] | null>`
  - `Editor.getAllProperties(): Promise<PageEntity[] | null>`
  - `Editor.getTagObjects(PageIdentity): Promise<BlockEntity[] | null>`

### 2. Plugin Property Namespacing
**Impact:** MEDIUM  
**Source:** User-provided information

- Plugin-defined block properties must now be namespaced: `plugin.property.<your_plugin>.<property>`
- Or use `plugin.property._api.<property>` if plugin ID is missing
- Plugin APIs now allow defining property type (default, number, node, date, checkbox, url, etc.)
- Plugin APIs now allow defining cardinality (one vs many)
- New support for arrays, objects, booleans, and numbers as block properties

### 3. Stricter Type Checking for API Parameters
**Impact:** LOW-MEDIUM

- `getBlock()` and `getPage()` now have stricter parameter types
- Some parameters that accepted `unknown` or loose types now require specific types
- Function parameters that were loosely typed now require explicit type matching

## Error Analysis by File

### src/anki-notes/ImageOcclusionNote.ts (4 errors)
**Lines 67, 113, 201, 334**

1. **Lines 67, 113:** `Property 'properties' does not exist on type 'BlockEntity | { uuid: string; }'`
   - Accessing `block.properties?.occlusion` on potentially incomplete block objects
   - Occurs in `handleImageOcclusionOperation()` and `getClozedContentHTML()`

2. **Line 201:** `Property 'properties' does not exist on type 'false | ImageOcclusionNote'`
   - Type narrowing issue in Promise.all() mapping

3. **Line 334:** `Property 'elements' does not exist on type 'object'`
   - Occlusion data typing issue

### src/anki-notes/MultilineCardNote.ts (4 errors)
**Lines 99, 100, 101, 235**

1. **Lines 99-101:** Direction string literal type mismatch
   - `Type '"<->"' | '"<-"' | '"->"' is not assignable to type...`
   - Property access on `this.properties.direction` with strict type checking

2. **Line 235:** `Property 'map' does not exist on type 'unknown'`
   - Type inference failure on children array

### src/anki-notes/Note.ts (1 error)
**Line 57**

- **Line 57:** `Argument of type 'number' is not assignable to parameter of type 'string'`
  - `getBlock()` or similar API call with wrong parameter type

### src/logseq/LogseqToHtmlConverter.ts (1 error)
**Line 335**

- **Line 335:** `Argument of type 'unknown' is not assignable to parameter of type 'number | PageIdentity'`
  - Page identity parameter type mismatch, likely in `getPage()` call

### src/ui/pages/LogseqAnkiFeatureExplorer.tsx (8 errors)
**Lines 654, 677, 681, 688, 750, 784, 891, 1049**

1. **Lines 654, 688, 750, 784, 891, 1049:** `Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'`
   - Functions return `{isEnabled: boolean; helpMsg?: string}` but type doesn't include optional `helpMsg`
   - Accessing `isEnabled.helpMsg` assumes it always exists

2. **Lines 677, 681:** `Argument of type '(p: any) => any' is not assignable to parameter of type 'number'`
   - setForceRefresh callback type mismatch with expected parameter

## Existing Implementations (No Action Needed)

The current codebase already has some workarounds in place:

### LogseqProxy.getPage() number ID handling
**Location:** `src/logseq/LogseqProxy.ts` lines 49-53

Already implemented:
```typescript
if (typeof srcPage === "number") {
    page = await logseq.Editor.getPage(srcPage);
    // properties are not returned when using dbid,
    // hence use name to fetch again
    page = await logseq.Editor.getPage(page.name);
}
```

This existing code already handles the case where properties aren't returned for number IDs. Our new helper method will incorporate this logic and add property fetching for both paths.

### Cache bypass comments
**Locations:** 
- `ImageOcclusionNote.ts` lines 67, 268
- `ImageOcclusionNote.ts` line 239

The code already has comments explaining why LogseqProxy cache is intentionally bypassed:
```typescript
// Dont use LogseqProxy.Editor.getBlock() here. It will cause a bug due to activeCache.
```

These locations now need to use the new `logseqPropertiesHelper()` helper instead of direct `logseq.Editor.getBlock()` calls.

## Proposed Solution Strategy

### Phase 1: Helper Method and LogseqProxy Enhancement (CRITICAL)
**Objective:** Maintain backward compatibility by enriching block/page objects with properties while supporting both cached and non-cached access patterns

#### 1.1 Create Helper Class in `src/logseq/` (NEW FILE: `logseqPropertiesHelper.ts`)

**Rationale:**
- Some places in the codebase intentionally bypass LogseqProxy cache to avoid stale data (e.g., ImageOcclusionNote.ts lines 67, 239)
- These places need fresh data with properties attached
- The helper class separates concerns: low-level property fetching logic vs. caching layer
- Can be used both in direct calls and within LogseqProxy
- Class structure provides clean organization and testability

**Implementation:**

```typescript
export class LogseqPropertiesHelper {
    private static stripPropertyPrefixes(properties: Record<string, any>): Record<string, any> {
        // Filters system properties and strips prefixes
        // :user.property/deck-bavZ5684 -> deck
        // :block/tags -> tags
        // :logseq.property.* -> filtered out
    }

    static async getBlock(
        srcBlock: BlockIdentity | EntityID,
        opts: Partial<{includeChildren: boolean}> = {}
    ): Promise<BlockEntity | null> {
        // Fetches block and properties, strips prefixes
    }

    static async getPage(
        srcPage: PageIdentity | EntityID
    ): Promise<PageEntity | null> {
        // Fetches page and properties, strips prefixes
    }
}

// Backward compatibility exports
export const logseqPropertiesHelper = LogseqPropertiesHelper.getBlock.bind(LogseqPropertiesHelper);
export const getPageWithProperties = LogseqPropertiesHelper.getPage.bind(LogseqPropertiesHelper);
```

#### 1.2 Update LogseqProxy to Use Helper Methods

**Implementation in `src/logseq/LogseqProxy.ts`:**

```typescript
import { logseqPropertiesHelper, getPageWithProperties } from "./logseqPropertiesHelper";

export class Editor {
    static getBlock = pMemoize(async (
        srcBlock: BlockIdentity | EntityID,
        opts: Partial<{includeChildren: boolean, suppressErrors: boolean}> = {suppressErrors: true}
    ): Promise<BlockEntity | null> => {
        srcBlock = typeof srcBlock === "string" ? srcBlock.toLowerCase() : srcBlock;
        let block = null;
        await getLogseqLock.acquireAsync();
        try {
            // Use helper method to fetch block with properties
            block = await logseqPropertiesHelper(srcBlock, opts);
        } catch (e) {
            console.error(e);
            if (!opts.suppressErrors) throw e;
        } finally {
            getLogseqLock.release();
        }
        return block;
    }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

    static getPage = pMemoize(async (
        srcPage: PageIdentity | EntityID, 
        opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}
    ): Promise<PageEntity | null> => {
        srcPage = typeof srcPage === "string" ? srcPage.toLowerCase() : srcPage;
        let page = null;
        await getLogseqLock.acquireAsync();
        try {
            // Use helper method to fetch page with properties
            page = await getPageWithProperties(srcPage);
        } catch (e) {
            console.error(e);
            if (!opts.suppressErrors) throw e;
        } finally {
            getLogseqLock.release();
        }
        return page;
    }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});
}
```

**Benefits:**
- Separation of concerns: property fetching logic is isolated in helper methods
- LogseqProxy provides cached access for sync operations
- Direct calls to helpers provide fresh data when cache would be problematic
- Property prefix stripping is centralized and consistent
- All downstream code continues to work without changes

**Performance Consideration:**
- Each `getBlock()` and `getPage()` call will trigger an additional API call for properties
- The p-memoize cache will prevent duplicate calls within the same sync operation
- Cache clears after sync via 'syncLogseqToAnkiComplete' event
- Places needing fresh data can call helpers directly, bypassing cache intentionally

### Phase 2: Type Fixes

#### 2.1 ImageOcclusionNote.ts
**Lines 67, 268 - Direct getBlock calls bypassing cache:**
```typescript
// Current:
block = await logseq.Editor.getBlock(uuid); // Bypasses cache intentionally

// Fix: Use helper method instead to get properties attached
import { logseqPropertiesHelper } from "../logseq/logseqPropertiesHelper";

block = await logseqPropertiesHelper(uuid);
// Now block.properties will be available with stripped prefixes
```

**Line 239 - Block reference fetching:**
```typescript
// Current:
const block_ref = await logseq.Editor.getBlock(blockUUID); // Bypasses cache intentionally

// Fix: Use helper method
import { logseqPropertiesHelper } from "../logseq/logseqPropertiesHelper";

const block_ref = await logseqPropertiesHelper(blockUUID);
```

**Line 201 - Type narrowing:**
```typescript
// Current:
imgToOcclusionDataHashMap[image].elements

// Fix: Add type guard or assertion
if (note && typeof note === 'object' && 'properties' in note) {
    const imgToOcclusionDataHashMap = ImageOcclusionNote.upgradeProperties(
        JSON.parse(Buffer.from(note.properties?.occlusion, "base64").toString())
    );
}
```

**Line 334 - Elements typing:**
```typescript
// Fix: Define proper OcclusionData type with elements property
const occlusionData = imgToOcclusionDataHashMap[k] as OcclusionData;
if (occlusionData && occlusionData.elements) {
    // ...
}
```

#### 2.2 MultilineCardNote.ts
**Lines 99-101 - Direction property typing:**
```typescript
// Current problematic code:
let direction = _.get(this, "properties.direction");

// Fix 1: Add type assertion
let direction = _.get(this, "properties.direction") as string | undefined;
if (direction !== "->" && direction !== "<-" && direction !== "<->") {
    // ...
}

// Fix 2: Use direct property access with fallback
let direction: string = this.properties?.direction || "";
```

**Line 235 - Children array typing:**
```typescript
// Current:
childrenList.map(...)

// Fix: Add type annotation or guard
const childrenList = child.children as Array<any>;
```

#### 2.3 Note.ts
**Line 57 - Parameter type mismatch:**
```typescript
// Need to see the actual code, but likely:
// Current:
await LogseqProxy.Editor.getBlock(someNumberId)

// Fix: Ensure correct parameter type
await LogseqProxy.Editor.getBlock(String(someNumberId))
// OR if it's an EntityID, keep as number
```

#### 2.4 LogseqToHtmlConverter.ts
**Line 335 - Page identity type:**
```typescript
// Need to see actual code, but likely:
// Fix: Add type assertion or guard
const pageIdentity = unknownValue as PageIdentity;
await LogseqProxy.Editor.getPage(pageIdentity);
```

#### 2.5 LogseqAnkiFeatureExplorer.tsx
**Multiple direct logseq.Editor.getBlock() calls:**
Locations: Lines 42, 49, 59, 60, 67, 75, 98, 99, 192, 924, 925, 956, 991

```typescript
// Current: Multiple places calling logseq.Editor.getBlock() directly
const block = await logseq.Editor.getBlock(editingBlockUUID);
const props = (await logseq.Editor.getBlock(editingBlockUUID)).properties;

// Fix: Use helper method for fresh properties
import { logseqPropertiesHelper } from "../../logseq/logseqPropertiesHelper";

const block = await logseqPropertiesHelper(editingBlockUUID);
const props = block?.properties;
```

**Multiple direct logseq.Editor.getPage() calls:**
Locations: Lines 50, 51, 76, 81, 82, 193

```typescript
// Current: Direct calls without property handling
const page = await logseq.Editor.getPage(block.page.id);

// Fix: Use helper method
import { getPageWithProperties } from "../../logseq/logseqPropertiesHelper";

const page = await getPageWithProperties(block.page.id);
```

**Lines 677, 681 - setForceRefresh callback type:**
```typescript
// Current:
setForceRefresh((p) => p+1);

// Issue: setForceRefresh type signature might be incorrect
// Fix: Check the actual type definition and ensure consistency
// Likely the prop type should be:
setForceRefresh: (updater: (prev: number) => number) => void;
```

### Phase 3: Property Namespacing and Plugin Property Updates

#### 3.1 Understanding Property Namespacing
In Logseq 0.2.3, plugin-defined properties are now namespaced:
- Format: `plugin.property.<plugin_id>.<property_name>`
- Or: `plugin.property._api.<property_name>` (if plugin ID is missing)

**Our properties affected:**
- `deck` → might become `plugin.property.logseq-anki-sync.deck`
- `tags` → might become `plugin.property.logseq-anki-sync.tags`
- `occlusion` → might become `plugin.property.logseq-anki-sync.occlusion`

**Strategy:** Our helper method `stripPropertyPrefixes()` handles this transparently by:
1. Detecting prefixed properties
2. Extracting the original property name (last part of the namespaced key)
3. Preferring non-prefixed properties in case of conflicts
4. Maintaining backward compatibility with older Logseq versions

#### 3.2 Plugin Property Writing Strategy
When writing properties via `upsertBlockProperty()`:
- **Short-term:** Continue using unprefixed property names (deck, tags, occlusion)
- **Long-term:** Monitor if Logseq automatically adds prefixes when writing
- **Testing needed:** Verify if properties written as `deck` are stored as `plugin.property.*.deck`

**Action items:**
- [ ] Test property writing behavior in Logseq 0.2.3
- [ ] Verify if existing properties in user graphs are affected
- [ ] Check if migration is needed for existing users
- [ ] Document property naming conventions

### Phase 4: Additional Investigations Required

1. **Understand full scope of property changes:**
   - ~~Review Logseq changelog and migration guides~~ (partially done via user info)
   - Test with actual running Logseq instance to confirm property fetching behavior
   - Verify stripPropertyPrefixes logic works correctly
   - Check if other API methods also changed return types

2. **Performance testing:**
   - Measure impact of additional property fetch calls during sync
   - Monitor if p-memoize caching is effective
   - Profile sync operation before and after changes

3. **Dependency hash cache validation:**
   - Verify `BlockAndPageHashCache.ts` still works correctly
   - Check if property structure changes affect hash calculation
   - Ensure transitive dependencies still invalidate properly

4. **Backward compatibility:**
   - Test with older Logseq versions that don't have property namespacing
   - Ensure helper methods don't break on older API versions
   - Consider version detection if needed

## Testing Strategy

### Pre-Migration Testing
1. Run existing test suite with current version
2. Document all passing tests as baseline

### Post-Migration Testing
1. **Type checking:** `npx tsc --noEmit` must pass with 0 errors
2. **Unit tests:** `pnpm test --run` must pass
3. **Integration tests:**
   - Test with actual Logseq instance (API server at http://127.0.0.1:12315)
   - Test all note types (ImageOcclusionNote, MultilineCardNote, ClozeNote, etc.)
   - Test sync operation end-to-end
   - Test property reading (deck, tags, occlusion, etc.)
   - Test property writing (upsertBlockProperty)

### Regression Testing
- [ ] Image occlusion creation and editing
- [ ] Multiline card with different directions
- [ ] Cloze card generation
- [ ] Deck property inheritance (namespace → page → block)
- [ ] Tags property merging
- [ ] Block reference rendering
- [ ] Page embed rendering
- [ ] Feature explorer UI functionality

## Implementation Checklist

### Phase 1: Helper Methods and LogseqProxy Enhancement
- [ ] Create new file `src/logseq/LogseqPropertiesHelper.test.ts`
- [ ] Implement `stripPropertyPrefixes()` function for property name cleanup
- [ ] Implement `logseqPropertiesHelper()` helper function
- [ ] Implement `getPageWithProperties()` helper function
- [ ] Update `LogseqProxy.ts` to import and use helper methods
- [ ] Run type check: `npx tsc --noEmit` (should reduce some errors)

### Phase 2: Type Fixes - Direct API Calls
- [ ] Fix ImageOcclusionNote.ts (lines 67, 239, 268) - replace direct getBlock calls with helper
- [ ] Fix LogseqAnkiFeatureExplorer.tsx getBlock calls (13 locations) - use helper method
- [ ] Fix LogseqAnkiFeatureExplorer.tsx getPage calls (6 locations) - use helper method
- [ ] Fix remaining type errors in MultilineCardNote.ts (4 errors)
- [ ] Fix remaining type error in Note.ts (1 error)
- [ ] Fix remaining type error in LogseqToHtmlConverter.ts (1 error)
- [ ] Fix remaining LogseqAnkiFeatureExplorer.tsx type errors (8 errors)
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Verify 0 type errors

### Phase 3: Property Namespacing Testing
- [ ] Test property writing with `upsertBlockProperty()`
- [ ] Verify properties are correctly prefixed/unprefixed by Logseq
- [ ] Test property reading with stripPropertyPrefixes logic
- [ ] Check existing user properties still work
- [ ] Document any migration requirements for users

### Phase 4: Integration Testing
- [ ] Run unit tests: `pnpm test --run`
- [ ] Start Logseq 0.2.3+ with API server
- [ ] Test image occlusion feature (create, edit, sync)
- [ ] Test multiline card with different directions
- [ ] Test cloze card generation
- [ ] Test deck property inheritance
- [ ] Test tags property merging
- [ ] Test sync operation end-to-end
- [ ] Performance testing of sync with new property fetching
- [ ] Test with older Logseq versions (backward compatibility)

### Phase 5: Documentation
- [ ] Update AGENTS.md with helper method patterns
- [ ] Document property access guidelines (use helpers vs LogseqProxy)
- [ ] Document property namespacing behavior
- [ ] Add migration notes to README if breaking changes exist
- [ ] Update inline comments explaining cache bypass rationale

## Risk Assessment

### HIGH RISK
- Property fetching logic in LogseqProxy could fail silently
- Performance degradation from additional API calls
- Cache coherency issues if properties change during sync

### MEDIUM RISK
- Type assertions could hide runtime errors
- Incomplete migration could leave some property access broken
- Plugin property namespacing might affect existing users' data

### LOW RISK
- Most errors are type-only, not runtime
- LogseqProxy approach maintains existing behavior
- Changes are localized to specific files

## Rollback Strategy

If critical issues are discovered:
1. Revert LogseqProxy changes
2. Downgrade `@logseq/libs` to previous version
3. Lock version in package.json
4. Document issues for future migration attempt

## Timeline Estimate

- **Phase 1 (Helper Methods & LogseqProxy):** 3-5 hours
- **Phase 2 (Type Fixes):** 5-7 hours
- **Phase 3 (Property Namespacing Testing):** 2-3 hours
- **Phase 4 (Integration Testing):** 4-8 hours
- **Phase 5 (Documentation):** 1-2 hours
- **Total:** 15-25 hours

## Open Questions

1. **API compatibility:** Are there more breaking changes not yet discovered in other @logseq/libs APIs?
2. **Property namespacing:** Will Logseq automatically prefix properties when we call `upsertBlockProperty()`, or do we need to handle it?
3. **Performance impact:** What is the actual performance impact of additional property fetching during sync?
4. **Hash calculation:** Do property structure changes affect hash calculation in `NoteHashCalculator`?
5. **Backward compatibility:** Should we detect Logseq version and conditionally fetch properties?
6. **User migration:** Do existing users need to migrate their property data, or does Logseq handle it automatically?
7. **Helper method error handling:** Should helper methods have suppressErrors option like LogseqProxy does?

## Next Steps

1. **Review this document** with stakeholders
2. **Create git branch** for migration work
3. **Implement Phase 1** (LogseqProxy Enhancement)
4. **Run type check** to confirm approach
5. **Proceed to Phase 2** if successful
6. **Commit frequently** with descriptive messages
7. **Run tests** after each major change

## Migration Status: ✅ COMPLETED

**Date Completed:** 2025-10-27

**Final Results:**
- ✅ All 18 type errors resolved
- ✅ Type check passes: `npx tsc --noEmit` - 0 errors
- ✅ Helper methods implemented and tested
- ✅ Property stripping logic verified with unit tests
- ✅ All direct API calls replaced with helper methods

**Actual Property Format Discovered:**
The actual property format in Logseq 0.2.3+ is `:user.property/name-suffix` (e.g., `:user.property/deck-bavZ5684`), not `plugin.property.*` as initially expected. The implementation has been updated accordingly.

**Key Files Modified:**
1. `src/logseq/LogseqPropertiesHelper.test.ts` - New helper methods created
2. `src/logseq/LogseqProxy.ts` - Updated to use helpers
3. `src/anki-notes/ImageOcclusionNote.ts` - Fixed direct API calls
4. `src/ui/pages/LogseqAnkiFeatureExplorer.tsx` - Fixed direct API calls
5. `tests/logseq/logseqPropertiesHelper.test.ts` - New tests added

**Testing Notes:**
- Unit tests requiring Logseq API server (converter tests) cannot run without a running instance at `127.0.0.1:12315`
- Property stripping logic verified with dedicated unit tests
- All non-integration tests pass successfully

## References

- `@logseq/libs` Type Definitions: `node_modules/@logseq/libs/dist/LSPlugin.d.ts`
- Current Error List: 18 type errors from `npx tsc --noEmit` → **RESOLVED**
- User-provided breaking changes information
- LogseqProxy implementation: `src/logseq/LogseqProxy.ts`
- Settings schema: `src/settings.ts`
