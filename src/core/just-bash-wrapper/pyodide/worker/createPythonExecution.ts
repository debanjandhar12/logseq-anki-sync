import type {PythonWorkerExecution} from "../workerProtocol";

export function createPythonExecution(execution: PythonWorkerExecution) {
    return {
        bootstrap: `
import os
import sys

os.makedirs(${JSON.stringify(execution.cwd)}, exist_ok=True)
os.chdir(${JSON.stringify(execution.cwd)})
os.environ.update(${JSON.stringify(execution.env)})
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
