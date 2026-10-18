import type {PyodideInterface} from "pyodide";
import {getLogseqLibModule} from "./getLogseqLibModule";
import type {LogseqLibBridge} from "./types";

export function installLogseqLib(pyodide: PyodideInterface, bridge: LogseqLibBridge): () => void {
    pyodide.registerJsModule("logseq_lib", getLogseqLibModule(bridge));
    pyodide.runPython(`
import importlib as _logseq_importlib
import json as _logseq_json
import sys as _logseq_sys
import types as _logseq_types

def _install_logseq_lib():
    bridge = _logseq_importlib.import_module("logseq_lib")
    module = _logseq_types.ModuleType("logseq_lib")
    loads = _logseq_json.loads
    def bind(name):
        js_method = getattr(bridge, name)
        async def call(args):
            if not isinstance(args, dict):
                raise TypeError(name + " expects an argument dictionary")
            return loads(await js_method(args))
        call.__name__ = name
        return call
    for name in ${JSON.stringify(bridge.methods)}:
        setattr(module, name, bind(name))
    _logseq_sys.modules["logseq_lib"] = module

_install_logseq_lib()
del _install_logseq_lib, _logseq_importlib, _logseq_json, _logseq_sys, _logseq_types
`);
    return () => {
        pyodide.runPython('import sys; sys.modules.pop("logseq_lib", None)');
        pyodide.unregisterJsModule("logseq_lib");
    };
}
