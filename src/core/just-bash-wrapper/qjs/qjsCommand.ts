import {defineCommand, type ExecResult} from "just-bash";
import {executeQuickJs} from "./quickJsRuntime";

const HELP = `Usage: qjs [-e CODE | FILE] [ARGS...]

Execute JavaScript in browser-compatible QuickJS. The runtime provides console,
process.argv, URL, URLSearchParams, and allowlisted fetch.
`;

function error(message: string): ExecResult {
    return {stdout: "", stderr: `qjs: ${message}\n`, exitCode: 2};
}

export const qjsCommand = defineCommand("qjs", async (args, context) => {
    if (args[0] === "--help" || args[0] === "-h") {
        return {stdout: HELP, stderr: "", exitCode: 0};
    }

    let code: string;
    let fileName: string;
    let scriptArgs: string[];
    if (args[0] === "-e") {
        if (args[1] == null) return error("-e requires JavaScript code");
        code = args[1];
        fileName = "<eval>";
        scriptArgs = args.slice(2);
    } else if (args[0]?.startsWith("-")) {
        return error(`unknown option ${JSON.stringify(args[0])}`);
    } else if (args[0]) {
        fileName = context.fs.resolvePath(context.cwd, args[0]);
        if (!(await context.fs.exists(fileName))) return error(`${args[0]}: No such file`);
        code = await context.fs.readFile(fileName);
        scriptArgs = args.slice(1);
    } else {
        code = new TextDecoder().decode(
            Uint8Array.from(context.stdin as unknown as string, (character) =>
                character.charCodeAt(0)
            )
        );
        fileName = "<stdin>";
        scriptArgs = [];
    }

    if (!code.trim()) return error("no input provided");
    if (code.startsWith("#!")) code = code.slice(Math.max(0, code.indexOf("\n") + 1));
    if (!context.fetch) return error("network access is not configured");

    return executeQuickJs({
        code,
        fileName,
        args: scriptArgs,
        cwd: context.cwd,
        env: context.exportedEnv ?? {},
        fetch: context.fetch,
        signal: context.signal
    });
});
