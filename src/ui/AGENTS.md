# UI Development Guidelines
This provides UI framework for the plugin.

## Styling & Theming
- Import colors from Logseq via the Tailwind theme in `src/ui/styles/main.css` (e.g., `bg-primary`)
- For custom colors not in theme, use Tailwind directly (e.g., `bg-green-600`) - no config changes needed
- Theme variables are managed by `ThemeManager` in `src/ui/theme/` - fetches and applies Logseq theme variables
- **Iframe context (modals)**: Theme applied to body via `UI.ts` using `ThemeManager.applyThemeToBody()`
- Theme automatically updates when Logseq theme changes

## UI Mounting System
- Modals are mounted to isolated iframe via UI.showModal() - with proper z-index stacking.
- Each modal gets unique ID and dedicated container for proper layering.
- Some framework components such as notifications mount directly to main DOM (window.parent) but cannot use React due to version conflicts.
- Chat UI sidebar is a special case where react component is directly mounted to main and only works when `viteReactBridgePlugin` successfully swaps the built-in react with logseq's react.
- Chat UI sidebar uses ShadowWrapper (shadow dom) to isolate styles from main DOM. The ShadowWrapper also uses ThemeManager.applyThemeToBody() similar to UI for styling.

## Designing Dropdowns
- Use `@floating-ui/react` for positioning dropdowns, popovers, and tooltips
- Follow existing patterns in `src/ui/components/LogseqTooltip.tsx` or reuse `src/ui/components/LogseqPopover.tsx`.

## Best Practices
- Use WindowParentBridge for parent window access instead of direct window.parent.
- Use WindowBridge for window access instead of window. window refers to isolated iframe. 
- Follow existing component patterns for consistency.
