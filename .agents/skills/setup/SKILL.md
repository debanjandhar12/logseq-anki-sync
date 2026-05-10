---
name: setup
description: Setup and configure assistant-ui in a project. Use when installing packages, configuring runtimes, setting up chat UI, or troubleshooting setup issues.
version: 0.1.0
license: MIT
---

# assistant-ui Setup

## CLI Commands

### Quick Decision Flow

- Existing Next.js app (`package.json` exists): use `npx assistant-ui@latest init`
- Existing app in CI/agent/non-interactive shell: use `npx assistant-ui@latest init --yes`
- Existing app + force overwrite of conflicts: add `--overwrite`
- New app / empty directory: use `npx assistant-ui@latest create <name>`
- Need specific starter template: add `-t <default|minimal|cloud|cloud-clerk|langgraph|mcp>`
- Need a curated example: use `npx assistant-ui@latest create <name> --example <example>`
- Need playground preset config: use `npx assistant-ui@latest create <name> --preset <url>`

### New Project (`create`)

```bash
npx assistant-ui@latest create my-app -t minimal
npx assistant-ui@latest create my-app -t cloud-clerk
npx assistant-ui@latest create my-app --preset "https://www.assistant-ui.com/playground/init?preset=chatgpt"
```

Templates:

| Template | Description |
|-------|-------|
| `default` | Default template with Vercel AI SDK |
| `minimal` | Bare-bones starting point |
| `cloud` | Cloud-backed persistence starter |
| `cloud-clerk` | Cloud-backed starter with Clerk auth |
| `langgraph` | LangGraph starter template |
| `mcp` | MCP starter template |

When `-t` is omitted:
- Interactive shell (TTY): an interactive template picker is shown.
- Non-interactive shell (CI/agent): template defaults to `default`.

If no project directory is provided in a non-interactive shell, `create` uses `my-aui-app`.

### Existing Next.js Project (`init`)

```bash
npx assistant-ui@latest init --yes
```

The `init` command is for **existing projects only** (requires `package.json`).
If no project is found, it automatically forwards to `create`.
Passing `--preset` to `init` also forwards to `create` (compatibility path).

The `--yes` flag runs non-interactively (no prompts).

### Add Registry Components

```bash
npx assistant-ui@latest add markdown-text
npx assistant-ui@latest add thread-list
```

Registry: `https://r.assistant-ui.com/{name}.json`

---

## Template Code Policy

When using CLI templates (`npx assistant-ui@latest create`), **never modify generated code** unless explicitly requested.

---

## Non-Default Setups

For runtimes other than AI SDK or frameworks other than Next.js, consult the reference files:

| Setup | Runtime Hook | Reference |
|-------|-------------|-----------|
| AI SDK advanced (tools, cloud, options) | `useChatRuntime` | [references/ai-sdk.md](./references/ai-sdk.md) |
| Styling and UI customization (shadcn pattern) | — | [references/styling.md](./references/styling.md) |
| LangGraph agents | `useLangGraphRuntime` | [references/langgraph.md](./references/langgraph.md) |
| AG-UI protocol | `useAgUiRuntime` | [references/ag-ui.md](./references/ag-ui.md) |
| A2A protocol | `useA2ARuntime` | [references/a2a.md](./references/a2a.md) |
| Custom streaming API | `useLocalRuntime` | [references/custom-backend.md](./references/custom-backend.md) |
| Existing state (Redux/Zustand) | `useExternalStoreRuntime` | [references/custom-backend.md](./references/custom-backend.md) |
| Vite / TanStack Start | — | [references/tanstack.md](./references/tanstack.md) |

---

## Deprecated Packages

NEVER install `@assistant-ui/styles` or `@assistant-ui/react-ui` — both are deprecated and deleted.

---

## Troubleshooting

For issues not covered by the reference files, use the docs website:

1. **Fetch the index**: `https://www.assistant-ui.com/llms.txt` — compact table of contents
2. **Fetch specific pages**: Append `.mdx` to the docs URL, e.g. `https://www.assistant-ui.com/docs/runtimes/ai-sdk.mdx`
