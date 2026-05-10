# Styling and Customization (shadcn Pattern)

assistant-ui UI components added by `init`/`create`/`add` are local source files. Style and customize them the same way you customize shadcn components: edit local TSX and theme tokens directly.

## Where to Customize

- `components/assistant-ui/*`: assistant-ui registry components (thread, tool-fallback, markdown-text, etc.)
- `components/ui/*`: shadcn base primitives (button, tooltip, dialog, sidebar, ...)
- `app/globals.css`: theme tokens (`:root`, `.dark`) and global overrides
- `lib/utils.ts`: `cn()` class merging helper used across components

## Theme Tokens (Tailwind v4 + shadcn style)

Components use shadcn theme tokens defined in `app/globals.css` and mapped to Tailwind v4 `@theme` variables. These help maintain a consistent style system.

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --radius: 0.625rem;
  /* ...other theme tokens */
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.9 0.001 286.0);
  /* ...other theme tokens */
}
```

## Dark Mode

Dark mode is class-based: toggling the `dark` class on `<html>` switches shadcn theme tokens to dark mode values.

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes";

<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>
```

## Common Layout Patterns

```tsx
// Full-height thread
<div className="h-screen">
  <Thread className="h-full" />
</div>

// Floating modal chat
<AssistantModal />

// Constrained-width centered thread
<div className="mx-auto max-w-2xl h-full">
  <Thread className="h-full" />
</div>
```

## Component-Level Customization with `cn()`

Use `cn()` when customizing local component styles (including child elements like a `Button` inside `Thread`) so you can layer conditional or external classes without breaking defaults. Keep edits in registry components (`components/assistant-ui/`) and rely on shadcn primitives for consistent composition.

`cn()` keeps base styles, then resolves conflicts so later classes win.

```tsx
<Button className={cn("thread-send-button", className)} />
```

```tsx
<ThreadPrimitive.Root
  className={cn(
    "aui-thread-root @container flex h-full flex-col bg-background",
    className
  )}
>
  {/* ... */}
</ThreadPrimitive.Root>
```

## Deep UI Control

For building entirely custom layouts, compose directly with `ThreadPrimitive`, `MessagePrimitive`, and `ComposerPrimitive` from `@assistant-ui/react`. See the `/primitives` skill for API details.

## Legacy / Deprecated

- Never install `@assistant-ui/styles` or `@assistant-ui/react-ui`, they are deprecated legacy packages.
- Existing `aui-*` classes in registry components are legacy identifiers — they do not impact styling and can be safely ignored.
