---
name: working-with-bash-and-pyodide
description: Use when running Bash commands, processing data with Python, performing symbolic calculations, fetching video transcripts, or interacting with Logseq through logseq_lib.
disable-model-invocation: false
built-in-skill: true
built-in-skill-user-controllable: false
---

# Working with Bash and Pyodide

The Bash tool runs in a virtual read-only filesystem with Pyodide support. Use `python`, `python3`, or `py` to run Python 3.14. Skills and command files can be modified through `logseq_lib`, which also provides programmatic access to Logseq pages and blocks. Host files and Node.js are unavailable.

Pyodide supports external Pyodide-compatible packages through `micropip`. Always pin exact versions, and install and use packages in the same command. Packages are not preserved between Bash tool invocations, and there is no pip wheel cache.

## Basic Usage Examples

### Symbolic integration

Use SymPy to integrate `x**2` and print the result as LaTeX:

```bash
python - <<'PY'
<% #includeFile %>internal/SYMPY_INTEGRATION.py<% /includeFile %>
PY
```

### YouTube transcript

Fetch a public English transcript with `youtube-transcript-api`:

```bash
python - <<'PY'
<% #includeFile %>internal/YOUTUBE_TRANSCRIPT.py<% /includeFile %>
PY
```

> For Bilibili, check `<% &virEnvUserPath %>/skills/working-with-bash-and-pyodide/examples/BILIBILI_TRANSCRIPT.py`.

## Using Logseq Lib

Import `logseq_lib` and await its methods with a single argument dictionary. Similar to your tools, you need to run the commit tool to persist changes.

### Listing available Logseq methods

```bash
python - <<'PY'
<% #includeFile %>internal/LIST_LOGSEQ_METHODS.py<% /includeFile %>
PY
```

### Creating a page and a child block

```bash
python - <<'PY'
<% #includeFile %>internal/CREATE_PAGE.py<% /includeFile %>
PY
```

### Creating a skill

```bash
python - <<'PY'
<% #includeFile %>internal/CREATE_SKILL.py<% /includeFile %>
PY
```

You can pair the above command with `read_raw_skill` to modify existing skills.