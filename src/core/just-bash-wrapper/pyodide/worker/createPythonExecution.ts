import {VIR_ENV_GID, VIR_ENV_HOSTNAME, VIR_ENV_UID} from "../../../../constants";
import type {PythonWorkerExecution} from "../types";

export function createPythonExecution(execution: PythonWorkerExecution) {
    return {
        bootstrap: `
import os
import platform
import socket
import sys

os.makedirs(${JSON.stringify(execution.cwd)}, exist_ok=True)
os.chdir(${JSON.stringify(execution.cwd)})
os.environ.update(${JSON.stringify(execution.env)})
_virtual_uname = os.uname()
os.uname = lambda: os.uname_result((
    _virtual_uname.sysname,
    ${JSON.stringify(VIR_ENV_HOSTNAME)},
    _virtual_uname.release,
    _virtual_uname.version,
    _virtual_uname.machine,
))
socket.gethostname = lambda: ${JSON.stringify(VIR_ENV_HOSTNAME)}
platform._uname_cache = None
os.getuid = os.geteuid = lambda: ${VIR_ENV_UID}
os.getgid = os.getegid = lambda: ${VIR_ENV_GID}
sys.argv = ${JSON.stringify([execution.fileName, ...execution.args])}
`,
        source: `
async def __run_python_command():
    import sys
    from pyodide.code import eval_code_async

    execution_globals = {
        "__name__": "__main__",
        "__file__": ${JSON.stringify(execution.fileName)},
    }
    try:
        await eval_code_async(
            ${JSON.stringify(execution.code)},
            execution_globals,
            filename=${JSON.stringify(execution.fileName)},
        )
    except SystemExit as error:
        if error.code is None:
            return 0
        if isinstance(error.code, int):
            return error.code
        print(error.code, file=sys.stderr)
        return 1
    return 0

await __run_python_command()
`
    };
}
