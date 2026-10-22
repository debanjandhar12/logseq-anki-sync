---
title: Logseq AstroBox
---

# Logseq AstroBox

Logseq AstroBox is an AI workspace for Logseq DB graphs. Chat with models from your
configured providers, attach graph content, use graph tools, and customize the
assistant with reusable commands and skills.

## Requirements and installation

AstroBox supports **DB graphs only**, not file graphs. Anki and AnkiConnect are not
required.

1. Download `logseq-astro-box.zip` from the
   [GitHub releases](https://github.com/debanjandhar12/logseq-astro-box/releases) and extract it.
2. In Logseq desktop, enable plugins and Developer mode. Open the Plugins dashboard
   and use **Load unpacked plugin** to select the extracted folder containing `package.json`.
3. Open Logseq AstroBox's plugin settings, choose **Open Provider Configurations**,
   configure a provider, enable a model, and save.
4. Run **Open Logseq AstroBox Chat** from the command palette, or choose **Open Chat**
   from the AstroBox toolbar menu.

Chat can open in a modal or the right sidebar. Sidebar rendering requires a
supported desktop environment; use the modal when the sidebar is unavailable.

## Explore the workspace

- [Provider configurations](providers/provider-configurations.md): set up accounts,
  endpoints, models, and optional web tools. Credentials are base64-encoded, not encrypted.
- [Commands](chat/commands.md): prepare reusable prompts from blocks and pages.
- [Skills](chat/skills.md): supply specialized instructions and supporting resources.
- [Bash sandbox](chat/bash-sandbox.md): understand the assistant's sandbox environment.

Review graph edits through the **Review & Commit** workflow before committing them.

## Plugin identity and publishing

The package and release archive are named `logseq-astro-box`. Plugin integrations
can open chat using the parent-window API `LogseqAstroBox.showAIChat()`.

The website and release links target `debanjandhar12/logseq-astro-box`. Publishing
requires renaming the existing GitHub repository and deploying GitHub Pages at the
new path. The existing Giscus repository and category IDs are preserved for that
same-repository rename; moving to a different repository would require reconfiguring
Giscus. Check existing pathname-mapped comments after changing the site path.
