# Project Structure

This is a Logseq plugin for one-way syncing flashcards to Anki with advanced features like image occlusion, cloze cards and block/page reference rendering.

- **Entry Point:** `src/index.ts` initializes the plugin, registers UI commands, and sets up event listeners
- **Output:** Build artifacts go to `dist/` directory
- **Dependencies:** Defined in `package.json`
- **Main Modules:**
  - `src/logseq/` - Logseq API interaction with caching layer (LogseqProxy)
  - `src/anki-connect/` - Anki Connect API integration
  - `src/sync/` - Core syncing logic with hash-based change detection
  - `src/anki-notes/` - Generates Anki notes from Logseq blocks
  - `src/ui/` - React-based UI components (modals, pages, settings)
  - `src/utils/` - Shared utility functions
  - `src/addons/` - Plugin addon system
  - `src/anki-template/` - Anki card templates

## Tech Stack

- **Language:** TypeScript
- **Build:** Vite with custom plugins for static file inlining and JS bundling
- **UI Framework:** React 17 with focus-trap-react
- **Testing:** Vitest with jsdom environment
- **Key Libraries:** @logseq/libs, mldoc (logseq markdown parsing), cheerio (HTML manipulation)

## Architecture

**LogseqProxy Cache Layer:** All Logseq API calls go through `LogseqProxy` which provides memoized, synchronization-safe wrappers around @logseq/libs using p-memoize. Cache clears after sync via 'syncLogseqToAnkiComplete' event. For fresh, non-cached data with properties attached, use `LogseqPropertiesHelper` class.

**Property Access (Logseq 0.2.3+):** Properties are now namespaced (e.g., `:user.property/deck-bavZ5684`). The `LogseqPropertiesHelper` class automatically fetches properties, strips prefixes, and filters system properties, maintaining backward compatibility. Use this helper when:
- Bypassing cache for fresh data (e.g., UI interactions, image occlusion editor)
- Direct API calls are needed outside LogseqProxy
- LogseqProxy automatically uses these internally for cached access

**Dependency Hash Cache:** `BlockAndPageHashCache.ts` maintains a dependency graph tracking block references, page embeds, and transitive dependencies. Each block's hash includes all dependency hashes plus metadata (page updatedAt, content length, parent/left ids). When a block changes, all dependent blocks' hashes automatically invalidate. Cache clears after sync via 'syncLogseqToAnkiComplete' event.

**Syncing System:** `syncLogseqToAnki.ts` uses `NoteHashCalculator` to compute note hashes from dependency hashes + plugin settings + Anki fields. Only notes with changed hashes trigger re-rendering and Anki updates.

**HTML Conversion:** `LogseqToHtmlConverter.ts` handles rendering Logseq markdown/org-mode to HTML, resolving block references, page embeds, PDF annotations, and other Logseq-specific syntax for Anki display.

**Settings:** Defined in `settings.ts` using `SettingSchemaDesc`. Access via `LogseqProxy.Settings.getPluginSettings()`, never directly through `logseq.settings`.

**UI Components:** React-based modals and pages live in `src/ui/`. Key pages include OcclusionEditor (fabric.js canvas for image occlusion) and feature explorer.

## Testing

**Test Location:** `tests/` directory with subdirectories matching src structure

**Running Tests:**
- `pnpm test --run` - Run all tests
- `pnpm test LogseqToHtmlConverter.test.ts --run` - Run specific test file
- `pnpm test -t "test case name" --run` - Run specific test case

**Testing Approach:**
- Vitest with jsdom environment
- Uses `logseq-proxy` package to proxy @logseq/libs calls to actual HTTP requests against running Logseq instance
- `tests/setup.ts` configures proxy to http://127.0.0.1:12315 - tests fail with fetch error if Logseq API server isn't running

## Best Practices

- **Code Organization:** Keep related functionality within appropriate module directories
- **Logseq API:** Always use LogseqProxy instead of direct @logseq/libs calls for caching and synchronization safety. However, do not use this inside LogseqPropertiesHelper.ts.
- **Property Access:** Use `LogseqPropertiesHelper` for block/page property access:
  - For cached access during sync: Use `LogseqProxy.Editor.getBlock()` / `getPage()` (properties included automatically)
  - For fresh, non-cached data: Use `LogseqPropertiesHelper.getBlock()` / `getPage()` from `src/logseq/logseqPropertiesHelper.ts`
  - Never call `logseq.Editor.getBlock()` / `getPage()` directly - properties won't be fetched/stripped properly
- **Tag Access:** Use `block.properties.tags` to access logseq tags array from a logseq block
- **HTML Conversion:** Use `LogseqToHtmlConverterProxy` for sync operations (cached), `LogseqToHtmlConverter` for UI operations (non-cached). Same pattern applies to `LogseqContentPreprocessorProxy` vs `LogseqContentPreprocessor`. Proxy classes extend base classes, override protected methods to use LogseqProxy, and add pMemoize caching that clears on 'syncLogseqToAnkiComplete' event
- **Parent Window Access:** Always use WindowParentBridge instead of direct `window.parent` access for iframe communication. WindowParentBridge provides type-safe, testable access to parent window objects (Logseq API, AnkiConnect, Fabric.js, DOM elements, etc.)
- **Settings Access:** Use `LogseqProxy.Settings.getPluginSettings()` instead of `logseq.settings`
- **React Imports:** Import React/ReactDOM from `ui/React.ts` and `ui/ReactDOM.ts`, not directly from npm packages
- **Anki Operations:** Use LazyAnkiNoteManager instead of direct AnkiConnect calls for note management
- **UI Development:** Follow existing modal/page patterns from `src/ui/` directory
- **Build & Dev:** Use `pnpm dev` for hot reload development, `pnpm build` for production (pnpm is enforced via preinstall)

# Development Guidelines
You are an elite software engineering assistant. Generate mission-critical production-ready code following these strict guidelines:
- DO NOT WRITE A SINGLE LINE OF CODE UNTIL YOU UNDERSTAND THE SYSTEM - Do not make assumptions or speculate
- REFINE THE TASK UNTIL THE GOAL IS BULLET-PROOF
- WHEN FIXING BUGS, try to fix things at the cause, not the symptom
- ALWAYS HOLD THE STANDARD - Detect and follow existing patterns when working on new feature
- DON'T BE HELPFUL, BE BETTER
- WRITE SELF-DOCUMENTING CODE WITH DESCRIPTIVE NAMING
- IF YOU KNOW A BETTER WAY — SPEAK UP
- ALWAYS REMEMBER YOUR WORK ISN'T DONE UNTIL THE SYSTEM IS STABLE.
- REMEMBER TO RUN TESTS and TYPE CHECK (`npx tsc --noEmit`) AFTER WORK IS DONE.