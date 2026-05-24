# Shadcn Development Guidelines
This provides shadcn components for the plugin. Custom Assistant UI components should be maintained in `src/chat-app/components` instead.
This should contain only original shadcn components.

## Notes
- The components.json file already contains assistant-ui registry.
- Importing of themes inside ShadowDOM / iframe is managed by `src/ui/theme/ThemeManager.tsx`.
- The shadcn folder is excluded in bromine since we are supposed to not modify directly.
- When customizing assistant ui components, copy to `src/chat-app/components` and modify it there.

## Commands
- Check diff with upstream components: `pnpm shadcn add button --diff --yes`
- Add / update components: `pnpm shadcn add @assistant-ui/thread --overwrite --yes`

Notes:
- Review diffs when overwriting
- Use `--overwrite` sparingly