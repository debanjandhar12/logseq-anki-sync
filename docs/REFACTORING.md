# Refactoring Recommendations

## Executive Summary

The codebase has **moderate to high technical debt** with several architectural issues that impact maintainability, testability, and type safety. This document outlines priority refactoring opportunities to improve code quality.

### Critical Metrics
- **Largest file:** `LogseqAnkiFeatureExplorer.tsx` (1,189 lines)
- **Estimated refactoring effort:** 2-3 weeks for high-priority items

---

## Priority 1: Critical Architectural Issues

### 1.1 God Component: LogseqAnkiFeatureExplorer.tsx (1,189 lines)

**Problem:**  
This file violates Single Responsibility Principle by handling:
- Feature documentation rendering
- Block content parsing
- Settings UI
- Image occlusion detection
- Cloze card detection
- Page tree navigation
- Event handling
- State management (10+ useState hooks)

**Refactoring Strategy:**

**Phase 1: Extract Feature Components**
```
src/ui/pages/LogseqAnkiFeatureExplorer/
├── index.tsx (main container, 150 lines max)
├── FeatureList.tsx (feature rendering logic)
├── BlockContentPreview.tsx (block content display)
├── ParentBlockInspector.tsx (parent block analysis)
├── PageTreeNavigator.tsx (page tree display)
├── hooks/
│   ├── useBlockContent.ts
│   ├── usePageTree.ts
│   ├── useParentBlocks.ts
│   └── useFeatureDetection.ts
├── utils/
│   ├── featureDetectors.ts
│   └── contentParsers.ts
└── types.ts
```

**Phase 2: Example Extracted Component**
```typescript
// FeatureList.tsx
interface Feature {
    id: string;
    title: string;
    description: string;
    isEnabled: boolean;
    helpMsg?: string;
}

interface FeatureListProps {
    features: Feature[];
    onFeatureToggle: (id: string, enabled: boolean) => void;
}

export const FeatureList: React.FC<FeatureListProps> = ({ 
    features, 
    onFeatureToggle 
}) => {
    return (
        <div className="feature-list">
            {features.map(feature => (
                <FeatureCard 
                    key={feature.id}
                    feature={feature}
                    onToggle={onFeatureToggle}
                />
            ))}
        </div>
    );
};
```

**Benefits:**
- Each file < 200 lines (maintainable)
- Clear separation of concerns
- Reusable components
- Easier testing (component-level tests)
- Better performance (React can optimize smaller components)

---

### 1.2 Mixed Concerns in Note Classes

**Problem:**  
Note classes (`ClozeNote`, `MultilineCardNote`, `ImageOcclusionNote`) mix:
- Business logic (note generation, HTML conversion)
- UI operations (`logseq.Editor.registerSlashCommand`, modal display)
- State management (properties, tags)

**Example from `ImageOcclusionNote.ts`:**
```typescript
export class ImageOcclusionNote extends Note {
    // Business logic
    public async getClozedContentHTML(): Promise<HTMLFile> { ... }
    
    // UI operations (shouldn't be here)
    public static initLogseqOperations = () => {
        logseq.Editor.registerBlockContextMenuItem("Image Occlusion", ...)
        logseq.Editor.registerSlashCommand("Image Occlusion", ...)
    }
    
    public static async handleImageOcclusionOperation(block: BlockEntity) {
        await showOcclusionEditor(...) // UI interaction
    }
}
```

**Refactoring Strategy:**

**Step 1:** Separate UI registration into dedicated classes:
```typescript
// src/ui/commands/ImageOcclusionCommand.ts
export class ImageOcclusionCommand {
    static register() {
        logseq.Editor.registerBlockContextMenuItem(
            "Image Occlusion", 
            this.handleOcclusion
        );
        logseq.Editor.registerSlashCommand(
            "Image Occlusion", 
            this.handleOcclusion
        );
    }
    
    private static async handleOcclusion(block: BlockEntity) {
        const note = await ImageOcclusionNote.fromBlock(block);
        const editor = new ImageOcclusionEditor(note);
        await editor.show();
    }
}
```

**Step 2:** Update Note classes to pure business logic:
```typescript
// src/anki-notes-generator/ImageOcclusionNote.ts
export class ImageOcclusionNote extends Note {
    // Only business logic, no UI
    public async getClozedContentHTML(): Promise<HTMLFile> { ... }
    
    public static async fromBlock(block: BlockEntity): Promise<ImageOcclusionNote> {
        // Factory method to create from block
    }
    
    public async getImages(): Promise<string[]> { ... }
}
```

**Step 3:** Create command registry:
```typescript
// src/ui/commands/index.ts
export class CommandRegistry {
    static registerAll() {
        ImageOcclusionCommand.register();
        ClozeNoteCommand.register();
        MultilineCardCommand.register();
        SwiftArrowCommand.register();
    }
}

// src/index.ts
CommandRegistry.registerAll();
```

**Benefits:**
- Testable business logic (no UI dependencies)
- Reusable Note classes
- Clear separation of concerns
- Easier to mock in tests

---

## Priority 2: Type Safety Issues

### 2.1 Disabled Strict Mode

**Problem:**  
`tsconfig.json` has `"strict": false`, hiding many type issues:
- Implicit `any` types everywhere
- No null/undefined checking
- Unsafe property access
- Type coercion bugs

**Current Config:**
```json
{
  "compilerOptions": {
    "strict": false,  // ❌ Hidden bugs
    "skipLibCheck": true,  // ❌ Skip type checking dependencies
    "esModuleInterop": false  // ❌ Module compat issues
  }
}
```

**Refactoring Strategy:**

**Phase 1: Enable strict checks incrementally**
```json
{
  "compilerOptions": {
    "strict": false,  // Keep disabled initially
    "noImplicitAny": true,  // Step 1: No implicit any
    "strictNullChecks": false,  // Enable in Step 2
    "strictFunctionTypes": true,
    "strictBindCallApply": true
  }
}
```

**Phase 2: Fix `noImplicitAny` errors** (estimate: ~50 locations)
```typescript
// Before
function processBlock(block) {  // Implicit any
    return block.content;
}

// After
function processBlock(block: BlockEntity): string {
    return block.content;
}
```

**Phase 3: Enable `strictNullChecks`** and fix (~100 locations)
```typescript
// Before
const page = await LogseqProxy.Editor.getPage(id);
const name = page.name;  // Error: page might be null

// After
const page = await LogseqProxy.Editor.getPage(id);
if (!page) return null;
const name = page.name;
```

**Phase 4: Enable full strict mode**
```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Benefits:**
- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code
- Safer refactoring

---

### 2.2 Missing Type Definitions

**Problem:**  
Many interfaces/types are incomplete or missing:
- `FeatureSetting` lacks `helpMsg` property
- `OcclusionData` not fully typed
- Plugin settings use generic objects
- DOM event types rely on `any`

**Refactoring Strategy:**

**Create comprehensive type definitions:**
```typescript
// src/types/features.d.ts
export interface FeatureSetting {
    isEnabled: boolean;
    helpMsg?: string;
    examples?: string[];
    documentation?: string;
}

export interface FeatureDefinition {
    id: string;
    title: string;
    description: string;
    category: 'note-types' | 'rendering' | 'sync' | 'ui';
    setting: FeatureSetting;
}

// src/types/occlusion.d.ts
export interface OcclusionElement {
    type: 'rect' | 'ellipse' | 'polygon' | 'text';
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}

export interface OcclusionData {
    version: number;
    elements: OcclusionElement[];
    imageUrl: string;
    imageDimensions: { width: number; height: number };
}

// src/types/events.d.ts
export interface InputChangeEvent extends React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> {
    target: HTMLInputElement | HTMLTextAreaElement;
}
```

**Benefits:**
- Clear contracts for data structures
- Better autocomplete
- Catch type errors early
- Self-documenting code

---

## Priority 3: Code Organization Issues

### 3.1 Inconsistent Error Handling

**Problem:**  
Error handling varies across the codebase:
- Some functions use try-catch with `suppressErrors` option
- Others throw errors directly
- Some log to console, others show UI messages
- No consistent error reporting strategy

**Examples:**
```typescript
// Pattern 1: Silent failures
LogseqProxy.Editor.getBlock(id, {suppressErrors: true})

// Pattern 2: Try-catch with generic handling
try {
    await operation();
} catch (e) {
    console.error(e);
}

// Pattern 3: Direct throws
throw new Error('Failed')

// Pattern 4: handleAnkiError utility
handleAnkiError(e.toString())
```

**Refactoring Strategy:**

**Step 1: Define error types:**
```typescript
// src/errors/ErrorTypes.ts
export class LogseqSyncError extends Error {
    constructor(
        message: string,
        public code: string,
        public recoverable: boolean = true,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'LogseqSyncError';
    }
}

export class AnkiConnectionError extends LogseqSyncError {
    constructor(message: string, originalError?: Error) {
        super(message, 'ANKI_CONNECTION', true, originalError);
    }
}

export class BlockNotFoundError extends LogseqSyncError {
    constructor(blockId: string) {
        super(`Block not found: ${blockId}`, 'BLOCK_NOT_FOUND', false);
    }
}
```

**Step 2: Create error handler service:**
```typescript
// src/errors/ErrorHandler.ts
export class ErrorHandler {
    static async handle(error: Error, context?: string): Promise<void> {
        // Log to console
        console.error(`[${context}]`, error);
        
        // Show user-friendly message
        if (error instanceof LogseqSyncError) {
            if (error.recoverable) {
                await logseq.UI.showMsg(error.message, 'warning');
            } else {
                await logseq.UI.showMsg(error.message, 'error');
            }
        } else {
            await logseq.UI.showMsg('An unexpected error occurred', 'error');
        }
        
        // Report to telemetry (if enabled)
        if (LogseqProxy.Settings.getPluginSettings().enableTelemetry) {
            await this.reportError(error, context);
        }
    }
    
    private static async reportError(error: Error, context?: string) {
        // Send to error tracking service
    }
}
```

**Step 3: Use consistently:**
```typescript
// Before
try {
    await syncOperation();
} catch (e) {
    console.error(e);
    await logseq.UI.showMsg(e.toString(), 'error');
}

// After
try {
    await syncOperation();
} catch (e) {
    await ErrorHandler.handle(
        e instanceof Error ? e : new Error(String(e)),
        'syncOperation'
    );
}
```

**Benefits:**
- Consistent error handling
- Better error messages for users
- Centralized error logging
- Optional error telemetry

---

### 3.2 Circular Dependencies Risk

**Problem:**  
Several modules have bidirectional dependencies:
- `Note` classes import from `UI` and vice versa
- `LogseqProxy` used everywhere
- `utils` import from business logic files

**Detection:**
```bash
# Run circular dependency check
npx madge --circular src/
```

**Refactoring Strategy:**

**Step 1: Apply Dependency Inversion Principle**
```typescript
// Before: Note depends on UI
import { showOcclusionEditor } from '../ui/pages/OcclusionEditor';

export class ImageOcclusionNote {
    async edit() {
        await showOcclusionEditor(...);
    }
}

// After: Use dependency injection
export interface IOcclusionEditor {
    show(data: OcclusionData): Promise<OcclusionData>;
}

export class ImageOcclusionNote {
    constructor(private editor?: IOcclusionEditor) {}
    
    async edit() {
        if (!this.editor) throw new Error('Editor not configured');
        await this.editor.show(...);
    }
}

// Wire up in main:
const editor = new OcclusionEditorImpl();
const note = new ImageOcclusionNote(editor);
```

**Step 2: Create clean layer architecture**
```
┌─────────────────────────────────────┐
│   UI Layer (React components)      │ ← Can depend on all below
├─────────────────────────────────────┤
│   Application Layer (commands)     │ ← Orchestrates business logic
├─────────────────────────────────────┤
│   Business Logic (Note classes)    │ ← No UI dependencies
├─────────────────────────────────────┤
│   Data Access (LogseqProxy, Anki)  │ ← Pure data operations
└─────────────────────────────────────┘
```

**Benefits:**
- No circular dependencies
- Clearer architecture
- Easier testing (mock interfaces)
- Better code reusability

---

### 3.3 Large File Sizes

**Problem:**  
Several files exceed 300 lines (recommended max: 250):

| File | Lines | Recommended Split |
|------|-------|-------------------|
| `LogseqAnkiFeatureExplorer.tsx` | 1,189 | 8 files |
| `syncLogseqToAnki.ts` | 684 | 3 files |
| `ImageOcclusionNote.ts` | 341 | 2 files |
| `MultilineCardNote.ts` | 306 | 2 files |
| `LogseqToHtmlConverter.ts` | ~400 | 3 files |

**Refactoring Strategy:**

**Split by responsibility:**
```typescript
// Before: syncLogseqToAnki.ts (684 lines)
export class LogseqToAnkiSync {
    async sync() { ... }
    private async performSync() { ... }
    private async scanForNotes() { ... }
    private async filterNotes() { ... }
    private async updateAnki() { ... }
    private async generateReport() { ... }
}

// After: Split into multiple services
// sync/SyncOrchestrator.ts (150 lines)
export class SyncOrchestrator {
    constructor(
        private scanner: NoteScannerService,
        private filter: NoteFilterService,
        private updater: AnkiUpdaterService,
        private reporter: SyncReporterService
    ) {}
    
    async sync() {
        const notes = await this.scanner.scan();
        const filtered = await this.filter.filter(notes);
        const results = await this.updater.update(filtered);
        await this.reporter.report(results);
    }
}

// sync/services/NoteScannerService.ts (100 lines)
// sync/services/NoteFilterService.ts (80 lines)
// sync/services/AnkiUpdaterService.ts (120 lines)
// sync/services/SyncReporterService.ts (90 lines)
```

**Benefits:**
- Easier to navigate
- Clear single responsibilities
- Better testing (test each service independently)
- Reduced merge conflicts

---

## Priority 4: Testing Infrastructure

### 4.1 Limited Test Coverage

**Problem:**  
Tests exist but coverage is unclear. Many critical paths untested.

**Refactoring Strategy:**

**Step 1: Measure current coverage:**
```json
// package.json
{
  "scripts": {
    "test:coverage": "vitest --coverage"
  }
}
```

**Step 2: Set coverage targets:**
```typescript
// vitest.config.ts
export default {
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            lines: 70,
            functions: 70,
            branches: 60,
            statements: 70
        }
    }
}
```

**Step 3: Add tests for critical paths:**
```typescript
// tests/sync/NoteHashCalculator.test.ts
describe('NoteHashCalculator', () => {
    it('should generate consistent hashes for same note', () => {
        const note1 = createTestNote();
        const note2 = createTestNote();
        
        expect(calculator.hash(note1)).toBe(calculator.hash(note2));
    });
    
    it('should generate different hashes when content changes', () => {
        const note1 = createTestNote({ content: 'A' });
        const note2 = createTestNote({ content: 'B' });
        
        expect(calculator.hash(note1)).not.toBe(calculator.hash(note2));
    });
});
```

**Step 4: Mock external dependencies:**
```typescript
// tests/mocks/LogseqProxyMock.ts
export const mockLogseqProxy = {
    Editor: {
        getBlock: vi.fn(),
        getPage: vi.fn(),
    },
    Settings: {
        getPluginSettings: vi.fn(() => defaultSettings)
    }
};
```

**Benefits:**
- Catch regressions early
- Confidence in refactoring
- Documentation through tests
- CI/CD integration

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Improve type safety and fix critical issues

1. ✅ Fix all TypeScript errors (see TYPESCRIPT_ERRORS.md)
2. ✅ Create WindowParentBridge abstraction
3. ✅ Enable `noImplicitAny` in tsconfig
4. ✅ Add missing type definitions

**Success Metrics:**
- 0 TypeScript errors
- All `window.parent` usage goes through WindowParentBridge
- < 10 `any` types in new code

### Phase 2: Architectural Cleanup (Week 3-4)
**Goal:** Separate concerns and improve structure

1. ✅ Split LogseqAnkiFeatureExplorer into components
2. ✅ Extract UI operations from Note classes
3. ✅ Create CommandRegistry
4. ✅ Implement ErrorHandler service

**Success Metrics:**
- No files > 300 lines
- UI and business logic separated
- Consistent error handling

### Phase 3: Testing & Quality (Week 5-6)
**Goal:** Improve reliability and maintainability

1. ✅ Add test coverage measurement
2. ✅ Write tests for core functionality
3. ✅ Enable `strictNullChecks`
4. ✅ Document all public APIs

**Success Metrics:**
- > 70% code coverage
- All critical paths tested
- Full TypeScript strict mode enabled

---

## Quick Wins (Can Start Today)

### 1. Create WindowParentBridge (2 hours)
Replace `window.parent` with abstraction layer.

### 2. Extract Type Definitions (3 hours)
Create `src/types/` with all interfaces.

### 3. Split One Large File (4 hours)
Start with `LogseqAnkiFeatureExplorer.tsx`.

### 4. Add Error Handler (3 hours)
Centralize error handling logic.

### 5. Enable noImplicitAny (4 hours)
First step toward strict mode.

**Total: 16 hours (2 days) for significant improvements**

---

## Long-term Vision

### Ideal Architecture (6 months)
```
src/
├── core/                    # Business logic (pure TypeScript)
│   ├── domain/             # Entities (Note, Block, Page)
│   ├── services/           # Business services
│   └── repositories/       # Data access interfaces
├── infrastructure/          # External integrations
│   ├── logseq/            # Logseq API implementation
│   ├── anki/              # Anki Connect implementation
│   └── storage/           # Cache implementations
├── application/            # Use cases & orchestration
│   ├── commands/          # Command handlers
│   └── queries/           # Query handlers
└── ui/                     # React components (depends on all above)
    ├── components/
    ├── pages/
    └── hooks/
```

### Benefits of Ideal Architecture
- **Testability:** Core logic testable without UI/Logseq
- **Portability:** Could support other note apps
- **Maintainability:** Clear boundaries and responsibilities
- **Scalability:** Easy to add features
- **Type Safety:** Full TypeScript strict mode

---

## Questions & Discussion

### Q: Should we enable strict mode immediately?
**A:** No, enable incrementally (see Phase 1). Immediate strict mode would reveal ~150 errors.

### Q: Is the WindowParentBridge worth the effort?
**A:** Yes. Current `window.parent` usage is fragile and makes testing difficult. WindowParentBridge pays for itself in reduced bugs and better tests.

### Q: Which refactoring has highest ROI?
**A:** Splitting LogseqAnkiFeatureExplorer (1,189 lines). It's causing performance issues and is hard to maintain.

### Q: Should we rewrite the plugin?
**A:** No. Incremental refactoring is safer and allows continuous feature delivery. Save rewrites for major version bumps.

---

## Conclusion

The codebase is functional but has accumulated technical debt. The refactoring plan above addresses the most critical issues first and provides a path to a more maintainable, type-safe, and testable codebase.

**Recommended Priority:**
1. **Must Do:** Fix TypeScript errors, create WindowParentBridge
2. **Should Do:** Split large files, separate UI from business logic
3. **Nice to Have:** Full test coverage, strict mode, error handler

**Estimated Total Effort:** 6-8 weeks for all Priority 1-3 items.
