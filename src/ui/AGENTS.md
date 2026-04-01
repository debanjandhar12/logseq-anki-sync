# UI Development Guidelines
This provides UI framework for the plugin.

## Styling & Theming
- Import colors from Logseq via tailwind.config.js and UI.ts (e.g., `bg-primary`)
- For custom colors not in theme, use Tailwind directly (e.g., `bg-green-600`) - no config changes needed
- Imported colors from logseq are automatically updated when logseq theme changes (`UI.ts`).

## React Import
- Always import React from `./React.ts` and ReactDOM from `./ReactDOM.ts`.
- Never import directly from 'react' or 'react-dom' packages.

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