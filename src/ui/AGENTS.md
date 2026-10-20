# UI Development Guidelines
This provides UI framework for the plugin.

## Styling & Theming
- Import colors from Logseq via theme/tailwind.config.mjs and theme/ThemeManager.ts (e.g., `bg-primary`)
- For custom colors not in theme, use Tailwind directly (e.g., `bg-green-600`) - no config changes needed
- ThemeManager fetches the variables listed in theme/constants.ts. UI.ts refreshes them on theme, theme-mode, and visibility changes.
- Preserve surface aliases such as `primary-background` and include every referenced host variable in theme/constants.ts for file and DB graph compatibility.

## React Import
- Import from `react`, `react-dom`, or `react-dom/client`. The Vite React bridge unifies all instances, including third-party imports and the automatic JSX runtime.

## UI Mounting System
- Modals are mounted to isolated iframe via UI.showModal() - with proper z-index stacking.
- Each modal gets unique ID and dedicated container for proper layering.
- Some framework components such as notifications mount directly to main DOM (window.parent) but cannot use React due to version conflicts.

## Designing Dropdowns
- Use `@floating-ui/react` for positioning dropdowns, popovers, and tooltips
- Follow existing patterns in `src/ui/components/LogseqTooltip.tsx` or reuse `src/ui/components/LogseqPopover.tsx`.

## Best Practices
- Use WindowParentBridge for parent window access instead of direct window.parent.
- Use WindowBridge for window access instead of window. window refers to isolated iframe. 
- Follow existing component patterns for consistency.
