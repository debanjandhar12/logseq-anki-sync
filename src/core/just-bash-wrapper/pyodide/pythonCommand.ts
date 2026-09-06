import {defineCommand, type ExecResult} from "just-bash";
import {executePython} from "./pyodideRuntime";

const HELP = `Usage: python [-c CODE | FILE | -] [ARGS...]

Execute Python in browser-compatible Pyodide. Top-level await and micropip are
available. Network access is restricted to allowlisted HTTPS hosts.
`;

function error(commandName: string, message: string): ExecResult {
    return {stdout: "", stderr: `${commandName}: ${message}\n`, exitCode: 2};
}

function createPythonCommand(commandName: "python" | "python3") {
    return defineCommand(commandName, async (args, context) => {
        if (args[0] === "--help" || args[0] === "-h") {
            return {stdout: HELP.replace("python", commandName), stderr: "", exitCode: 0};
        }
        if (args[0] === "--version" || args[0] === "-V") {
            return {stdout: "Python 3.14.2 (Pyodide 314.0.6)\n", stderr: "", exitCode: 0};
        }

        const stdin = decodeStdin(context.stdin as unknown as string);
        let code: string;
        let fileName: string;
        let scriptArgs: string[];
        let programStdin = stdin;
        if (args[0] === "-c") {
            if (args[1] == null) return error(commandName, "-c requires Python code");
            code = args[1];
            fileName = "<string>";
            scriptArgs = args.slice(2);
        } else if (args[0] === "-" || args[0] == null) {
            code = stdin;
            programStdin = "";
            fileName = "<stdin>";
            scriptArgs = args[0] === "-" ? args.slice(1) : [];
        } else if (args[0].startsWith("-")) {
            return error(commandName, `unknown option ${JSON.stringify(args[0])}`);
        } else {
            fileName = context.fs.resolvePath(context.cwd, args[0]);
            if (!(await context.fs.exists(fileName))) {
                return error(commandName, `${args[0]}: No such file`);
            }
            code = await context.fs.readFile(fileName);
            scriptArgs = args.slice(1);
        }

        if (!code.trim()) return error(commandName, "no input provided");
        if (code.startsWith("#!")) code = code.slice(Math.max(0, code.indexOf("\n") + 1));
        if (!context.fetch) return error(commandName, "network access is not configured");

        return executePython({
            code,
            fileName,
            args: scriptArgs,
            stdin: programStdin,
            cwd: context.cwd,
            env: context.exportedEnv ?? {},
            fetch: context.fetch,
            signal: context.signal
        });
    });
}

function decodeStdin(stdin: string): string {
    return new TextDecoder().decode(Uint8Array.from(stdin, (character) => character.charCodeAt(0)));
}

export const pythonCommand = createPythonCommand("python");
export const python3Command = createPythonCommand("python3");
