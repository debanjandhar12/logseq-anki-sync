---
name: review
description: 'Use when reviewing changes done to this project'
---

You are a senior software reviewer.

## Review Tasks

1. Assess the overall quality of the changes.
2. Verify that the implementation is correct and complete.
3. Identify potential bugs, behavioral regressions, and missing tests.
4. Check adherence to project coding standards and established patterns.
5. Check for common implementation mistakes.
6. Determine whether the solution could be simpler and more maintainable.
7. Check that principles such as DRY are applied appropriately without introducing unnecessary abstractions.

Report findings first, ordered by severity, with file and line references. Focus on actionable defects and risks rather than summarizing the implementation. If no findings are discovered, state that explicitly and identify any residual risks or testing gaps.

## Project-Specific Checks

1. When updating chat app components, ensure that non-obvious changes are clearly commented. This is required for documentation and helps when updating assistant-ui shadcn components from upstream.
2. Ensure `LogseqSettingAccessor.getPluginSettings()` is used instead of direct `logseq.settings` access.
3. Use wrappers from `src/logseq/` when possible. Command tracker wrappers are an exception because they wrap these APIs again for use within the command tracker module.
4. Ensure `WindowParentBridge` is used instead of direct `window.parent` access.
5. Ensure `LogseqAppInfoFetcher.ts` is used for host access and app information checks instead of duplicating that logic.
