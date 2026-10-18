import json
import sys
import logseq_lib

page_name = sys.argv[1] if len(sys.argv) > 1 else "Pyodide example notes"
page = await logseq_lib.create_page({"pageName": page_name})
block = await logseq_lib.insert_block({
    "parentUuid": page["uuid"],
    "content": "Created from Python with logseq_lib.",
    "sibling": False,
})
print(json.dumps({"pageUuid": page["uuid"], "blockUuid": block["uuid"]}))
