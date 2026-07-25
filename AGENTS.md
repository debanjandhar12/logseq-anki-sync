# Project Structure

This is a Logseq plugin for ai chat using ai-sdk and assistant-ui.

- **Entry Point:** `src/index.ts` initializes the plugin, registers UI commands, and sets up event listeners
- **Output:** Build artifacts go to `dist/` directory
- **Dependencies:** Defined in `package.json`
- **Main Modules:**
  - `src/logseq/` - Logseq API interaction wrappers
  - `src/ui/` - React-based UI components (modals, pages, settings)
  - `src/chat/` - Chat ui
  - `src/ai/` - ai sdk wrappers and assistant ui runtimes

## Tech Stack

- **Language:** TypeScript
- **Build:** Vite with custom plugins for static file inlining and JS bundling
- **UI Framework:** React 18 with focus-trap-react
- **Testing:** Vitest with jsdom environment
- **Key Libraries:** @logseq/libs, mldoc (logseq markdown parsing), cheerio (HTML manipulation)

## Architecture
**Settings:** Defined in `settings.ts` using `SettingSchemaDesc`. Access via `LogseqSettingAccessor.getPluginSettings()`, never directly through `logseq.settings`.
**UI Components:** React-based modals and pages live in `src/ui/`. Chat app lives in `src/chat`.
**Theme & CSS Isolation:** Theme management centralized in `src/ui/theme/`. Chat Sidebar uses `ShadowWrapper` for CSS isolation. Other UI are already isolated from logseq as they are in iframes.

## Testing

**Test Location:** `tests/` directory with subdirectories matching src structure

**Running Tests:**
- `pnpm test --run` - Run all tests
- `pnpm test getModal.test.ts --run` - Run specific test file
- `pnpm test -t "test case name" --run` - Run specific test case

**Testing Approach:**
- Vitest with jsdom environment
- Uses `logseq-proxy` package to proxy @logseq/libs calls to actual HTTP requests against running Logseq instance
- `tests/setup.ts` configures proxy to http://127.0.0.1:12315 - tests fail with fetch error if Logseq API server isn't running

## Best Practices

- **Code Organization:** Keep related functionality within appropriate module directories
- **Logseq API:** Always use wrappers from `src/logseq/` directory when possible.
- **Parent Window Access:** Always use WindowParentBridge instead of direct `window.parent` access for iframe communication. WindowParentBridge provides type-safe, testable access to parent window objects (Logseq API, AnkiConnect, Fabric.js, DOM elements, etc.)
- **Settings Access:** Use `LogseqSettingAccessor.getPluginSettings()` instead of `logseq.settings`
- **UI Development:** Follow existing modal/page patterns from `src/ui/` directory
- **Build & Dev:** Use `pnpm dev` for hot reload development, `pnpm build` for production (pnpm is enforced via preinstall)
- **Documentation:** When implementing new features or making significant changes, remember to update the documentation in the `docusaurus/` directory to keep it in sync with the codebase.
- **Logging:** Use the centralized logger from `src/logger` with appropriate `LoggerCategory` for consistent logging. Never use `console.log()` directly.

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
- AT END, ALWAYS RUN `npm run check <filename>` and `npm run check:fix <filename>` to run biome linter and formater.
- RUN biome and tsc for MODIFIED files only.

# Writing PLANs
- Always create and save the generated plan inside the .air/plans/ folder.
- Include semi-detailed code design. Avoid Unicode diagrams.

## Plan Document Structure & Formatting

1. User Requirement -> Paste the user's original requirement verbatim, with no alterations or paraphrasing.
2. Final Requirement After Discussion With User
   1. Clarification Q&A -> Document all clarifying questions asked and the corresponding answers provided by the user (if requirements were ambiguous or conflicting).
   2. Final Summarized Requirements -> Provide a concise, clear summary of the agreed-upon scope and requirements. Avoid repeating.
3. Solution -> Detail the proposed changes using clear sub-sections. Focus on structural details (e.g., file paths, class definitions, static vs. instance methods, module dependencies, and architectural flow) rather than writing full production code.