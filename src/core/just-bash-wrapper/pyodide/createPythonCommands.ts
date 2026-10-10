import {type ByteString, defineCommand, type ExecResult} from "just-bash";
import type {Options} from "yargs-parser";
import parser from "yargs-parser/browser";
import {VIR_ENV_USER_PATH} from "../../../constants";
import {applySandboxChanges} from "./just-bash-fs-bridge/applySandboxChanges";
import {captureSandboxSnapshot} from "./just-bash-fs-bridge/captureSandboxSnapshot";
import {SandboxWriteBackAbortedError} from "./just-bash-fs-bridge/SandboxWriteBackAbortedError";
import type {WriteBackFailure} from "./just-bash-fs-bridge/types";
import {executePython} from "./pyodideRuntime";
import type {SandboxSnapshot} from "./sandbox-tree/types";

const HELP = `Usage: python [-c CODE | FILE | -] [ARGS...]

Execute Python in browser-compatible Pyodide. Top-level await and micropip are
available. Network access is restricted to allowlisted HTTPS hosts.
`;

function error(commandName: string, message: string, exitCode = 2): ExecResult {
    return {stdout: "", stderr: `${commandName}: ${message}\n`, exitCode};
}

const PARSER_OPTIONS: Options = {
    boolean: ["help", "version"],
    string: ["command"],
    alias: {help: "h", version: "V", command: "c"},
    narg: {command: 1},
    configuration: {
        "short-option-groups": false,
        "camel-case-expansion": false,
        "dot-notation": false,
        "boolean-negation": false,
        "parse-numbers": false,
        "parse-positional-numbers": false,
        "duplicate-arguments-array": false,
        "halt-at-non-option": true
    }
};

export function createPythonCommands(...commandNames: string[]) {
    if (commandNames.some((name) => !name || /\s/.test(name))) {
        throw new Error("Python command aliases must be non-empty and contain no whitespace");
    }
    if (new Set(commandNames).size !== commandNames.length) {
        throw new Error("Python command aliases must be unique");
    }
    return commandNames.map(createPythonCommand);
}

function createPythonCommand(commandName: string) {
    return defineCommand(commandName, async (args, context) => {
        let parsed: ReturnType<typeof parseArguments>;
        try {
            parsed = parseArguments(args);
        } catch (cause) {
            return error(commandName, cause instanceof Error ? cause.message : String(cause));
        }
        if (parsed.help) {
            return {stdout: HELP.replace("python", commandName), stderr: "", exitCode: 0};
        }
        if (parsed.version) {
            return {stdout: "Python 3.14.2 (Pyodide 314.0.6)\n", stderr: "", exitCode: 0};
        }

        const stdin = decodeStdin(context.stdin);
        let code: string;
        let fileName: string;
        let scriptArgs: string[];
        let programStdin = stdin;
        if (parsed.command !== undefined) {
            code = parsed.command;
            fileName = "<string>";
            scriptArgs = args.slice(2);
        } else if (args[0] === "-" || args[0] == null) {
            code = stdin;
            programStdin = "";
            fileName = "<stdin>";
            scriptArgs = args[0] === "-" ? args.slice(1) : [];
        } else {
            fileName = context.fs.resolvePath(context.cwd, args[0]);
            if (!(await context.fs.exists(fileName))) {
                return error(commandName, `${args[0]}: No such file`);
            }
            code = await context.fs.readFile(fileName);
            scriptArgs = args.slice(1);
        }

        if (code.startsWith("#!")) {
            const newline = code.indexOf("\n");
            code = newline === -1 ? "" : code.slice(newline + 1);
        }
        if (!code.trim()) return error(commandName, "no input provided");
        if (!context.fetch) return error(commandName, "network access is not configured");

        let snapshot: SandboxSnapshot;
        try {
            snapshot = await captureSandboxSnapshot(context.fs, VIR_ENV_USER_PATH);
        } catch (cause) {
            return error(
                commandName,
                `cannot snapshot sandbox filesystem: ${getErrorMessage(cause)}`,
                1
            );
        }

        const result = await executePython({
            code,
            fileName,
            args: scriptArgs,
            stdin: programStdin,
            cwd: context.cwd,
            env: context.exportedEnv ?? {},
            snapshot,
            fetch: context.fetch,
            signal: context.signal
        });
        if (!result.changes) return toExecResult(result);
        if (context.signal?.aborted) {
            return {
                stdout: result.stdout,
                stderr: `${result.stderr}${commandName}: execution aborted before filesystem write-back\n`,
                exitCode: 124
            };
        }

        // Once this commit starts, it runs to completion rather than exposing a
        // partially applied filesystem to cancellation.
        let failures: WriteBackFailure[];
        try {
            failures = await applySandboxChanges(
                context.fs,
                result.changes,
                snapshot,
                context.signal
            );
        } catch (cause) {
            if (cause instanceof SandboxWriteBackAbortedError) {
                return {
                    stdout: result.stdout,
                    stderr: `${result.stderr}${commandName}: ${cause.message}\n`,
                    exitCode: 124
                };
            }
            throw cause;
        }
        const writeBackErrors = failures
            .map(
                ({path, message}) =>
                    `${commandName}: cannot write back ${JSON.stringify(path)}: ${message}\n`
            )
            .join("");
        return {
            stdout: result.stdout,
            stderr: result.stderr + writeBackErrors,
            exitCode: failures.length > 0 && result.exitCode === 0 ? 1 : result.exitCode
        };
    });
}

function toExecResult(result: Awaited<ReturnType<typeof executePython>>): ExecResult {
    return {stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode};
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function decodeStdin(stdin: ByteString): string {
    // just-bash 3.2's browser bundle omits its public byte helpers. ByteString's
    // runtime representation is Latin-1; keep the conversion at this boundary.
    return new TextDecoder().decode(
        Uint8Array.from(stdin as unknown as string, (character) => character.charCodeAt(0))
    );
}

function parseArguments(args: string[]): {help?: boolean; version?: boolean; command?: string} {
    const first = args[0];
    if (first == null || first === "-") return {};
    let interpreterArgs: string[];
    if (first === "-c") {
        if (args[1] == null) throw new Error("-c requires Python code");
        interpreterArgs = [`--command=${args[1]}`];
    } else if (["--help", "-h", "--version", "-V"].includes(first)) {
        interpreterArgs = [first];
    } else if (first.startsWith("-")) {
        throw new Error(`unknown option ${JSON.stringify(first)}`);
    } else {
        interpreterArgs = args;
    }
    const result = parser.detailed(interpreterArgs, PARSER_OPTIONS);
    if (result.error) throw result.error;
    return {help: result.argv.help, version: result.argv.version, command: result.argv.command};
}
