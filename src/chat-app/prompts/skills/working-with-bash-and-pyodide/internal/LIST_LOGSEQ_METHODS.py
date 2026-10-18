import json
import logseq_lib

methods = sorted(
    name for name in dir(logseq_lib)
    if not name.startswith("_") and callable(getattr(logseq_lib, name))
)
print(json.dumps(methods))
