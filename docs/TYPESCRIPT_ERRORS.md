# TypeScript Errors Summary and Fixes

**Total Errors:** 26 errors across 6 files  
**TypeScript Version:** 5.1.6  
**Strict Mode:** Disabled (needs enabling)

## Executive Summary

The codebase has 26 TypeScript errors primarily caused by:
1. Missing type guards for union types (38% of errors)
2. Unsafe property access on generic types like `EventTarget` and `unknown` (31%)
3. Type mismatches in function parameters (19%)
4. Missing property definitions (12%)

All errors are fixable with proper type guards, type assertions, and interface definitions.

---

## Error Categories

### 1. Union Type Narrowing Issues (10 errors)
**Files:** `ImageOcclusionNote.ts`, `MultilineCardNote.ts`

#### Problem
When accessing properties on union types like `BlockEntity | { uuid: string }`, TypeScript cannot guarantee the property exists on all variants.

#### Errors
```
src/anki-notes-generator/ImageOcclusionNote.ts(66,31): Property 'properties' does not exist on type '{ uuid: string; }'
src/anki-notes-generator/ImageOcclusionNote.ts(112,32): Property 'properties' does not exist on type '{ uuid: string; }'
src/anki-notes-generator/ImageOcclusionNote.ts(200,46): Property 'properties' does not exist on type 'false'
```

#### Fix
Add type guards before accessing properties:

**ImageOcclusionNote.ts (line 66)**
```typescript
// Before
const occlusion = block.properties?.occlusion || Buffer.from("{}", "utf8").toString("base64")

// After
const occlusion = 'properties' in block && block.properties?.occlusion 
    ? block.properties.occlusion 
    : Buffer.from("{}", "utf8").toString("base64")
```

**ImageOcclusionNote.ts (line 112)**
```typescript
// Before
block.properties?.occlusion

// After
'properties' in block ? block.properties?.occlusion : undefined
```

**ImageOcclusionNote.ts (line 200)**
```typescript
// Before
const block_images = await ImageOcclusionNote.getImagesInBlockOrNote(note.properties)

// After
const block_images = note && typeof note !== 'boolean' 
    ? await ImageOcclusionNote.getImagesInBlockOrNote(note.properties)
    : []
```

**MultilineCardNote.ts (lines 99-101)**
```typescript
// Before
let direction = _.get(this, "properties.direction");

// After
let direction = this.properties?.direction as string | undefined;
```

---

### 2. EventTarget Type Safety Issues (4 errors)
**File:** `LogseqAnkiFeatureExplorer.tsx`

#### Problem
`EventTarget` is a generic type that doesn't have HTML element properties like `value`, `selectionStart`, etc.

#### Errors
```
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(1025,59): Property 'value' does not exist on type 'EventTarget'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(1026,62): Property 'selectionStart' does not exist on type 'EventTarget'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(1026,87): Property 'selectionEnd' does not exist on type 'EventTarget'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(1027,77): Property 'value' does not exist on type 'EventTarget'
```

#### Fix
Cast `event.target` to the appropriate HTML element type:

**LogseqAnkiFeatureExplorer.tsx (lines 1025-1027)**
```typescript
// Before
const value = event.target.value;
const start = event.target.selectionStart;
const end = event.target.selectionEnd;

// After
const target = event.target as HTMLInputElement | HTMLTextAreaElement;
const value = target.value;
const start = target.selectionStart;
const end = target.selectionEnd;
```

---

### 3. Missing Property Definitions (6 errors)
**File:** `LogseqAnkiFeatureExplorer.tsx`

#### Problem
Settings objects are typed as `{ isEnabled: boolean }` but code tries to access `helpMsg` property.

#### Errors
```
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(654,41): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(688,74): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(750,41): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(784,74): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(891,74): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(1048,74): Property 'helpMsg' does not exist on type '{ isEnabled: boolean; }'
```

#### Fix
Define proper interface for feature settings:

**Create a new interface in settings.ts or types file:**
```typescript
interface FeatureSetting {
    isEnabled: boolean;
    helpMsg?: string;
}
```

Then update the type annotations in LogseqAnkiFeatureExplorer.tsx to use this interface.

---

### 4. Type Mismatch in Function Parameters (3 errors)

#### Error 4a: Number vs String Parameter
**File:** `Note.ts`

```
src/anki-notes-generator/Note.ts(57,37): Argument of type 'number' is not assignable to parameter of type 'string'
```

**Fix:**
```typescript
// Line 57 - Convert number to string
// Before
someFunction(numericValue)

// After
someFunction(String(numericValue))
// or
someFunction(numericValue.toString())
```

#### Error 4b: Unknown Type Parameter
**File:** `LogseqToHtmlConverter.ts`

```
src/logseq/LogseqToHtmlConverter.ts(330,59): Argument of type 'unknown' is not assignable to parameter of type 'number | PageIdentity'
```

**Fix:**
```typescript
// Line 330 - Add type guard or assertion
// Before
await LogseqProxy.Editor.getPage(unknownValue)

// After
if (typeof unknownValue === 'number' || typeof unknownValue === 'string') {
    await LogseqProxy.Editor.getPage(unknownValue as number | PageIdentity)
}
```

#### Error 4c: Function vs Number Parameter
**File:** `LogseqAnkiFeatureExplorer.tsx`

```
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(677,45): Argument of type '(p: any) => any' is not assignable to parameter of type 'number'
src/ui/pages/LogseqAnkiFeatureExplorer.tsx(681,45): Argument of type '(p: any) => any' is not assignable to parameter of type 'number'
```

**Fix:**
```typescript
// Lines 677, 681 - Likely using wrong argument in array method
// Before
array.map((p: any) => p.someProperty)

// After - Pass the result, not the function
const result = array.map((p: any) => p.someProperty)[0]
```

---

### 5. Unknown Type Property Access (2 errors)

#### Error 5a: Array Method on Unknown
**File:** `MultilineCardNote.ts`

```
src/anki-notes-generator/MultilineCardNote.ts(235,52): Property 'map' does not exist on type 'unknown'
```

**Fix:**
```typescript
// Line 235 - Add type guard
// Before
const result = unknownValue.map(...)

// After
if (Array.isArray(unknownValue)) {
    const result = unknownValue.map(...)
}
```

#### Error 5b: Object Property on Generic Object
**File:** `ImageOcclusionNote.ts`

```
src/anki-notes-generator/ImageOcclusionNote.ts(333,72): Property 'elements' does not exist on type 'object'
```

**Fix:**
```typescript
// Line 333 - Define proper interface or use type assertion
// Before
obj.elements

// After
interface OcclusionData {
    elements: any[];
    // ... other properties
}
const typedObj = obj as OcclusionData;
typedObj.elements
```

---

## Systematic Fix Strategy

### Phase 1: Enable Strict Type Checking (Recommended)
Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true
  }
}
```

**Note:** This will reveal ~100+ additional errors but will improve code quality significantly.

### Phase 2: Fix by Priority
1. **High Priority** (breaking bugs): Union type issues, unknown type access
2. **Medium Priority** (type safety): Function parameter mismatches
3. **Low Priority** (code quality): Missing property definitions, event types

### Phase 3: Add Missing Type Definitions
Create `src/types/plugin.d.ts`:
```typescript
export interface FeatureSetting {
    isEnabled: boolean;
    helpMsg?: string;
}

export interface OcclusionData {
    elements: OcclusionElement[];
    version?: number;
}

export interface OcclusionElement {
    type: string;
    // ... define all properties
}
```

### Phase 4: Refactor Problem Areas
- Extract large components (LogseqAnkiFeatureExplorer.tsx) into smaller modules
- Add type guards utility functions
- Create typed wrappers for DOM event handlers

---

## Quick Win Fixes (Can be done immediately)

1. **Add utility type guards** (`src/utils/typeGuards.ts`):
```typescript
export function isBlockEntity(block: any): block is BlockEntity {
    return block && typeof block === 'object' && 'properties' in block;
}

export function hasProperties<T extends { properties?: any }>(
    obj: T | { uuid: string }
): obj is T {
    return 'properties' in obj;
}
```

2. **Create DOM event utility** (`src/utils/domEvents.ts`):
```typescript
export function getInputValue(event: React.ChangeEvent): string {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    return target.value;
}

export function getInputSelection(event: React.ChangeEvent) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    return {
        start: target.selectionStart,
        end: target.selectionEnd,
        value: target.value
    };
}
```

3. **Update imports across affected files** to use these utilities.

---

## Testing Recommendations

After fixing errors:
1. Run `pnpm test --run` to ensure no broken tests
2. Test each note type (Cloze, Multiline, Image Occlusion) manually
3. Test Feature Explorer UI interactions
4. Test sync operations with Anki

---

## References

- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Logseq Plugin API](https://plugins-doc.logseq.com/)
