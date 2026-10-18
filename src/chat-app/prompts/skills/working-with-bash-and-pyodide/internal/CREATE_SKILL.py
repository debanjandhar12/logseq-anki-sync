import json
import sys
import logseq_lib

skill_name = sys.argv[1] if len(sys.argv) > 1 else "pyodide-example-notes"
content = f"""---
name: {skill_name}
description: Use when preparing concise notes from supplied material.
---
# Concise notes

Summarize the supplied material as concise Logseq blocks.
"""
await logseq_lib.save_skill({"skillName": skill_name, "content": content})
saved = await logseq_lib.read_raw_skill({"skillName": skill_name})
print(json.dumps(saved))
