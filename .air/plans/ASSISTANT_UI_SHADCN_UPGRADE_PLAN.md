# Plan: Upgrade assistant-ui shadcn Components

## Objective

Refresh the locally owned assistant-ui registry components to the latest upstream registry state
without losing Logseq-specific behavior, custom chat composition, Shadow DOM compatibility, or the
project's source-ownership boundary.

This is primarily a source upgrade, not a runtime package migration. The assistant-ui shadcn
registry copies source files into this repository and does not assign semantic versions to those
files. Therefore, the implementation must record an immutable upstream baseline rather than relying
only on `latest`.

## Implementation Record

Implemented on July 12, 2026 against assistant-ui repository commit
[`4a55ff95d1df5bbe03fa50bfebbfae0c72412698`](https://github.com/assistant-ui/assistant-ui/commit/4a55ff95d1df5bbe03fa50bfebbfae0c72412698)
and the registry responses served by `https://r.assistant-ui.com` on that date.

Implementation decisions:

1. Upgraded `shadcn` from `4.8.0` to `4.13.0`; assistant-ui runtime packages were already current
   and remained unchanged.
2. Refreshed all existing assistant-ui registry components and added the new transitive
   `follow-up-suggestions` and `input` registry files.
3. Upgraded Tailwind CSS from `3.4.19` to `4.3.2` and adopted `@tailwindcss/vite` so the upstream
   `@theme`, `@custom-variant`, variable shorthand, and compound variants compile correctly.
4. Replaced the Tailwind 3-only `tailwindcss-animate` plugin with `tw-animate-css@1.4.0`, while
   preserving `tw-shimmer` and the registry's collapsible animation definitions.
5. Migrated the Logseq semantic palette and font families from function-valued JavaScript config to
   CSS-first `@theme inline` tokens so Tailwind 4 emits all theme utilities and opacity variants.
6. Preserved the prior sRGB behavior for semantic opacity modifiers, restored pointer cursors for
   enabled controls, and retained the project thread list's established spacing rather than adopting
   the tighter registry defaults.
7. Kept complete project-overridden `Thread`, `ThreadList`, `DiffViewer`, and `ToolFallback`
   components unexported. Re-exported only the decomposed registry pieces consumed by project-owned
   components.
8. Adopted loading-aware new-chat layout, current suggestions, standalone tool grouping, data and
   indicator part rendering, tool elapsed time, upload states, current collapsible behavior, and
   current component styling.
9. Did not expose follow-up suggestions, dictation, or generic tool-approval controls because the
   local runtime does not provide those capabilities. The existing Logseq commit review flow remains
   the supported human-action path.
10. Added focused tests for ordinary, standalone, and Logseq-specific tool grouping plus fallback
   timing, error, and required-action behavior.

The registry currently assumes two type shapes not present in npm's latest
`@assistant-ui/react@0.14.26`: attachment upload errors with a `message` field and unconstrained
inference for multiple grouped-part keys. The generated source contains minimal compatibility
adjustments for those cases and for project export ownership.

## Baseline And Target

The following versions were checked against npm on July 12, 2026:

| Package | Declared/installed target | npm latest | Required action |
| --- | ---: | ---: | --- |
| `@assistant-ui/react` | `0.14.26` | `0.14.26` | No version change |
| `@assistant-ui/react-ai-sdk` | `1.3.40` | `1.3.40` | No version change |
| `@assistant-ui/react-markdown` | `0.14.5` | `0.14.5` | No version change |
| `@assistant-ui/core` | `0.2.20` | `0.2.20` | No version change |
| `assistant-stream` | `0.3.25` | `0.3.25` | No version change |
| `shadcn` | `4.8.0` | `4.13.0` | Upgrade the CLI before regeneration |
| `tailwindcss` | `3.4.19` | `4.3.2` | Upgrade for current registry syntax |
| `@tailwindcss/vite` | Not installed | `4.3.2` | Use the Tailwind 4 Vite integration |

The project already uses the current unified assistant-ui APIs (`AuiIf`, `useAui`, and
`useAuiState`), AI SDK 6, React 19, and Zod 4. No legacy assistant-ui API migration was found in
`src`.

Before implementation, repeat the npm checks because `latest` is time-dependent:

```bash
pnpm view @assistant-ui/react version
pnpm view @assistant-ui/react-ai-sdk version
pnpm view @assistant-ui/react-markdown version
pnpm view @assistant-ui/core version
pnpm view assistant-stream version
pnpm view shadcn version
```

If assistant-ui package versions have advanced, stop and reassess their release notes and peer
dependencies before refreshing registry source. Runtime packages and generated components must be
upgraded as one compatible set.

## Repository Constraints

The implementation must preserve these project rules:

1. `src/shadcn/assistant-ui` contains upstream registry source, with only export adjustments allowed.
2. Modified assistant-ui components live in `src/chat-app/components`.
3. Custom components document their differences from upstream in their source comments.
4. Registry imports must resolve to the existing aliases in `components.json`; do not accept the
   known duplicate `assistant-ui/assistant-ui` nesting.
5. Theme loading remains owned by `src/ui/theme/ThemeManager.ts`; generated components must not add
   direct parent-window or host-page styling assumptions.
6. The project uses Tailwind CSS 4 through `@tailwindcss/vite`. Preserve registry-owned Tailwind
   directives and selectors rather than translating them to legacy syntax.
7. Existing unrelated worktree changes must not be overwritten.

## Current Component Inventory

The current registry copies are:

| Registry component | Current project consumers or customization risk |
| --- | --- |
| `attachment.tsx` | Shared primitives are consumed by custom `AttachmentUI`; Logseq attachment types and pill styling must survive |
| `context-display.tsx` | Used by `ThreadTopToolBar`; includes project behavior for retaining the last non-zero token count |
| `diff-viewer.tsx` | Shared primitives are consumed by custom `DiffViewer`; export visibility is intentionally adjusted |
| `markdown-text.tsx` | Used directly by custom assistant messages and reasoning; code-copy and markdown styling are user-visible |
| `reasoning.tsx` | Shared primitives are consumed by custom `AssistantMessage`; default collapsed behavior is project-owned |
| `thread-list.tsx` | `ThreadListSkeleton` is consumed by custom `ThreadList`; full upstream component is not used directly |
| `thread.tsx` | Several pieces are imported by custom `Thread`, `AssistantMessage`, and `UserMessage`; this is the highest-risk reconciliation |
| `tool-fallback.tsx` | Decomposed by custom `ToolFallback`; upstream now includes duration and approval UI |
| `tool-group.tsx` | Shared primitives are consumed by custom `AssistantMessage`; grouping exclusions are project-owned |
| `tooltip-icon-button.tsx` | Used throughout custom chat controls; styling and tooltip behavior affect most actions |

The latest `thread` registry item also depends on `follow-up-suggestions`, which is not currently in
the repository. It must be added only if the project adopts the upstream follow-up suggestion UI;
otherwise the custom `Thread` must intentionally omit it and document that decision.

## Upstream Changes Requiring Explicit Decisions

The registry snapshot inspected on July 12, 2026 includes changes that cannot be handled as a
format-only refresh:

1. `thread` adds component override slots for assistant messages, welcome content, fallback tools,
   tool groups, and reasoning groups.
2. `thread` changes empty-thread layout and distinguishes startup loading from a genuinely empty
   chat.
3. `thread` adds follow-up suggestions, voice dictation controls, attachment rendering, and new
   composer styling.
4. `thread` uses `groupPartByType`, handles standalone tool calls, and renders `data` and `indicator`
   message parts.
5. `thread` no longer filters MCP app tool parts through the old local callback; verify the new
   standalone-tool behavior with this project's MCP rendering.
6. `tool-fallback` adds elapsed duration, auto-opening for required actions, approval options,
   confirmation flows, and approval response APIs.
7. `tool-fallback`, `reasoning`, and `tool-group` change collapsible open-state selectors and motion
   behavior.
8. Registry CSS includes Tailwind 4 `@custom-variant` and `@theme` declarations, which require the
   Tailwind 4 build pipeline.
9. Registry export sets have changed. Local export suppression must be re-applied only where a
   project-owned replacement exists.

These changes should be adopted by capability, not by visual diff alone.

## Implementation Plan

### Phase 1: Freeze A Reproducible Upstream Baseline

1. Record the implementation date, resolved npm versions, and the assistant-ui registry repository
   commit or immutable source URLs in the eventual pull request or commit notes.
2. Save the raw registry JSON for every selected component in a temporary directory outside the
   repository for comparison. Do not commit generated snapshots unless maintainers decide they are
   useful long-term.
3. Run `git status --short` and preserve all pre-existing changes.
4. Upgrade only the `shadcn` development dependency first:

```bash
pnpm add --save-dev shadcn@4.13.0
```

5. Re-run the registry dry-run with the upgraded CLI. Confirm that paths resolve to
   `src/shadcn/assistant-ui` and `src/shadcn/radix-ui` before writing anything.

### Phase 2: Produce Complete Diffs Before Overwriting

Run one component at a time so the CLI does not truncate its combined diff:

```bash
pnpm shadcn add @assistant-ui/thread --diff --yes
pnpm shadcn add @assistant-ui/attachment --diff --yes
pnpm shadcn add @assistant-ui/tool-group --diff --yes
pnpm shadcn add @assistant-ui/tool-fallback --diff --yes
pnpm shadcn add @assistant-ui/reasoning --diff --yes
pnpm shadcn add @assistant-ui/diff-viewer --diff --yes
pnpm shadcn add @assistant-ui/markdown-text --diff --yes
pnpm shadcn add @assistant-ui/thread-list --diff --yes
pnpm shadcn add @assistant-ui/context-display --diff --yes
pnpm shadcn add @assistant-ui/tooltip-icon-button --diff --yes
```

For each command:

1. Inspect all transitive files, including Radix shadcn components and CSS changes.
2. Classify each difference as upstream behavior, project export adjustment, import-path rewrite,
   project customization accidentally left in `src/shadcn`, or formatting only.
3. Note newly introduced dependencies and registry components before updating `package.json`.
4. Do not use a single broad `--overwrite` command. It would obscure component ownership and make
   recovery of export adjustments error-prone.

### Phase 3: Refresh Upstream-Owned Source

Update one logical group at a time with `--overwrite --yes`, reviewing `git diff` after each group:

1. Low-coupling primitives: `tooltip-icon-button`, `diff-viewer`, and `context-display`.
2. Content rendering: `markdown-text` and `attachment`.
3. Collapsible displays: `reasoning`, `tool-group`, and `tool-fallback`.
4. Navigation: `thread-list`.
5. Composition root: `thread`, last.

After each overwrite:

1. Correct generated import paths to match `components.json` if the CLI produces duplicate nesting.
2. Re-apply only the documented export adjustments needed by project-owned components.
3. Move any true customization found in `src/shadcn` into `src/chat-app/components` instead of
   retaining a fork in the registry directory.
4. Review transitive Radix component changes individually. For example, the current dry-run proposes
   adding `"use client"` to `src/shadcn/radix-ui/tooltip.tsx`; include it only as part of the reviewed
   generated update.
5. Verify that all new utility classes are emitted by the Tailwind 4 build.

### Phase 4: Reconcile Project-Owned Components

#### Thread And Message Rendering

Update `src/chat-app/components/Thread.tsx` and
`src/chat-app/components/AssistantMessage.tsx` against the new upstream composition while preserving:

1. Project-owned `Composer` and `ThreadMessage` decomposition.
2. Exclusion of `LogseqCommitChangesTool` from grouped tools.
3. Collapsed-by-default reasoning and zero bottom margins for reasoning/tool groups.
4. Project-owned assistant/user action bars.
5. Existing MCP app rendering behavior.

Adopt the new `groupPartByType` helper only if it can express the Logseq tool exclusion and MCP
behavior clearly. Regardless of grouping implementation, add cases for `data` and `indicator` parts
and explicitly handle standalone tool calls so new runtime parts are not silently dropped.

Decide independently whether to adopt:

1. Centered empty-chat layout and the loading-aware `isNewChatView` selector.
2. Follow-up suggestions and the new `follow-up-suggestions.tsx` registry dependency.
3. Voice dictation controls, based on whether the local runtime exposes the required capability.
4. Upstream attachment placement, since the project has a custom Logseq attachment UI.
5. New component override context, which may reduce future source copying but should not duplicate
   the existing project decomposition without a concrete benefit.

Document every intentional divergence in the custom components' `Changes` comments.

#### Tool Fallback And Approval

Rebase `src/chat-app/components/ToolFallback.tsx` on the new decomposed upstream exports while
preserving circular status icons and the project's `isError` handling.

Add support for the new upstream behavior:

1. Render elapsed tool duration.
2. Open automatically when a tool requires user action.
3. Forward `addResult`, `resume`, `interrupt`, `approval`, and `respondToApproval` as appropriate.
4. Render `ToolFallbackApproval` for required actions.
5. Preserve cancellation display and suppress results only when cancellation requires it.

Approval responses are a functional boundary, not merely UI. Verify that they are compatible with
the project's tool-result convention and local runtime persistence before enabling them. Add focused
tests for allow, deny, configured approval options, confirmation, and resumed execution.

#### Attachments

Reconcile shared attachment helpers with `src/chat-app/components/AttachmentUI.tsx`. Preserve Logseq
block, page, property page, tag page, and PDF labels/icons, pill styling, non-shrinking behavior, and
message/composer removal rules. Test both image object URLs and non-image Logseq attachments.

#### Context Display

Determine whether the latest registry still needs the project's retained non-zero token count. If
it does, move that behavior to a project-owned wrapper and restore the registry file to upstream
source. Verify thread switches, loading states, cached token counts, and a zero-token response.

#### Diff Viewer, Markdown, Reasoning, Tool Group, And Thread List

1. Preserve the custom `DiffViewer` decomposition and expose only the upstream pieces it consumes.
2. Verify markdown code-copy behavior, GFM tables, links, inline code, and fenced code styling inside
   the Shadow DOM.
3. Retain collapsed reasoning and custom grouping behavior in project-owned code, not registry code.
4. Preserve `ThreadListSkeleton` use and local thread loading behavior.
5. Revisit removed or added exports after all imports compile; do not export dead registry APIs only
   for backward compatibility.

### Phase 5: Styles And Dependencies

1. Upgrade Tailwind CSS and install the matching `@tailwindcss/vite` integration.
2. Replace `@tailwind` directives with `@import "tailwindcss"` and migrate the Logseq semantic
   colors and fonts into CSS-first `@theme inline` tokens.
3. Replace `tailwindcss-animate` with the Tailwind 4-compatible `tw-animate-css` import. Keep
   `@import "tw-shimmer"` exactly once.
4. Preserve the registry's `data-open`, `data-closed`, and `@theme` declarations. Verify the emitted
   production CSS contains the corresponding selectors and collapsible keyframes.
5. Add `follow-up-suggestions` and any new package only when its feature is adopted.
6. Let `pnpm` update `pnpm-lock.yaml`; inspect the lockfile for unrelated dependency churn.

## Test Plan

### Automated Tests

Add or update focused tests for behavior changed by the registry refresh:

1. Empty, loading, and populated thread layouts.
2. `data`, `indicator`, reasoning, regular tool-call, standalone tool-call, MCP app, and
   `LogseqCommitChangesTool` rendering paths.
3. Tool fallback states: running, successful, failed through `isError`, incomplete, cancelled, and
   requires action.
4. Tool approval allow/deny, declared options, confirmation, and resume callbacks if adopted.
5. Attachment preview URL lifecycle and Logseq attachment rendering.
6. Thread list loading skeleton and thread item actions.
7. Context usage across thread switches and zero/non-zero updates.

Prefer component tests with mocked assistant-ui state for UI-only cases. Avoid requiring the Logseq
proxy unless the behavior genuinely crosses the Logseq API boundary.

Run:

```bash
pnpm test --run
npx tsc --noEmit
pnpm build
```

The full test suite may report fetch failures when the Logseq API proxy at `127.0.0.1:12315` is not
running. Separate environment failures from regressions and run proxy-dependent tests with Logseq
available before accepting the upgrade.

### Manual Verification

Verify the production build in Logseq, in both light and dark themes and at desktop and narrow
sidebar widths:

1. Start a new chat, send a message, stop generation, and regenerate a response.
2. Edit, copy, branch, and export messages.
3. Switch, create, archive, and delete threads.
4. Add, preview, remove, send, reload, and persist image and Logseq entity attachments.
5. Render markdown headings, lists, tables, links, inline code, and fenced code; copy a code block.
6. Expand and collapse reasoning, tool groups, and fallback tools during and after streaming.
7. Exercise a successful tool, failed tool, cancelled tool, and approval-required tool.
8. Confirm MCP apps and `LogseqCommitChangesTool` retain their custom presentation.
9. Confirm scrolling remains stable when collapsibles open/close and while streaming.
10. Confirm tooltips, dialogs, and menus render inside the intended isolated UI layer.

## Formatting And Final Validation

Run Biome only for modified supported source/configuration files. The generated `src/shadcn` folder
is excluded by project policy, but project-owned TSX, `package.json`, and other supported files still
require checks:

```bash
npm run check <modified-files>
npm run check:fix <modified-files>
npm run check <modified-files>
npx tsc --noEmit
pnpm build
```

Then run final regression searches:

```bash
rg 'useAssistantApi|useAssistantState|useAssistantEvent|AssistantIf|submitOnEnter' src
rg 'assistant-ui/assistant-ui' src components.json
rg 'from "src/shadcn/assistant-ui/' src/chat-app/components
git diff --check
git status --short
```

Review every remaining shadcn import from project-owned components and confirm it is an intentional
shared primitive rather than a customization left in the upstream directory.

## Rollout Strategy

Keep the implementation reviewable in logical commits if commits are requested:

1. Upgrade `shadcn` and refresh low-coupling registry components.
2. Refresh collapsible/content components and reconcile styles.
3. Refresh `thread`/`thread-list` and rebase custom chat components.
4. Add or update tests and documentation.

Do not mix unrelated assistant-ui runtime refactors into this upgrade. If a new registry component
requires a runtime capability that this project does not expose, omit that feature explicitly and
track it separately rather than adding a partial implementation.

## Acceptance Criteria

- Every selected file in `src/shadcn/assistant-ui` matches the recorded upstream registry snapshot,
  except documented import-path and export adjustments.
- All Logseq-specific UI behavior remains in `src/chat-app/components` and is documented there.
- New message part types are rendered or intentionally documented as unsupported; none are silently
  discarded.
- Tool fallback approval behavior is either fully wired and tested or explicitly omitted without
  exposing non-functional controls.
- The Tailwind 4 build includes all required animations, data-state variants, and shimmer styles.
- No duplicate assistant-ui directory nesting or broken aliases are introduced.
- Type checking, production build, applicable tests, Biome checks, and manual Logseq verification
  pass.
- The final change records the exact npm versions and immutable registry baseline used for the
  upgrade.
