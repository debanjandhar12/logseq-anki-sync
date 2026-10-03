// @vitest-environment node
import {releaseProxy} from "comlink";
import type {PyodideInterface} from "pyodide";
import {describe, expect, test, vi} from "vitest";
import {createPythonGlobals} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createPythonGlobals";
import {executePythonInWorker} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/executePythonInWorker";
import type {
    PythonWorkerExecution,
    PythonWorkerFetch
} from "../../../../../../src/core/just-bash-wrapper/pyodide/workerProtocol";

const execution: PythonWorkerExecution = {
    code: "print(2)",
    fileName: "test.py",
    args: [],
    stdin: "",
    cwd: "/work",
    env: {}
};

function fixture() {
    const pyodide = {
        setStdout: vi.fn(),
        setStderr: vi.fn(),
        setStdin: vi.fn(),
        loadPackage: vi.fn(async () => undefined),
        runPython: vi.fn(),
        runPythonAsync: vi.fn(async () => 0)
    };
    const runtime = {
        pyodide: pyodide as unknown as PyodideInterface,
        originalFetch: globalThis.fetch,
        allowedLocalAssetUrls: new Set<string>(),
        capabilities: createPythonGlobals()
    };
    const release = vi.fn();
    const hostFetch = Object.assign(vi.fn<PythonWorkerFetch>(), {[releaseProxy]: release});
    return {pyodide, runtime, release, hostFetch};
}

describe("worker execution cleanup", () => {
    test.each([
        "setStdout",
        "setStderr",
        "setStdin",
        "loadPackage",
        "runPython",
        "runPythonAsync"
    ] as const)("cleans up after %s fails", async (method) => {
        const {pyodide, runtime, hostFetch, release} = fixture();
        pyodide[method].mockImplementation(() => {
            throw new Error("setup failed");
        });
        await expect(executePythonInWorker(runtime, execution, hostFetch)).resolves.toEqual({
            stdout: "",
            stderr: "setup failed\n",
            exitCode: 1
        });
        expect(globalThis.fetch).toBe(runtime.originalFetch);
        expect(runtime.capabilities.globals.fetch).toBeUndefined();
        expect(release).toHaveBeenCalledOnce();
    });

    test("captures output and tolerates callback release failure", async () => {
        const {pyodide, runtime, hostFetch, release} = fixture();
        pyodide.setStdout.mockImplementation(({write}) => write(new TextEncoder().encode("2\n")));
        release.mockImplementation(() => {
            throw new Error("release failed");
        });
        expect(await executePythonInWorker(runtime, execution, hostFetch)).toEqual({
            stdout: "2\n",
            stderr: "",
            exitCode: 0
        });
        expect(globalThis.fetch).toBe(runtime.originalFetch);
        expect(pyodide.loadPackage).toHaveBeenCalledWith("micropip");
    });

    test("returns an ordinary failure result for overflow and invalid exit status", async () => {
        const first = fixture();
        first.pyodide.setStdout.mockImplementation(({write}) =>
            write(new Uint8Array(1024 * 1024 + 1))
        );
        expect(
            (await executePythonInWorker(first.runtime, execution, first.hostFetch)).stderr
        ).toContain("output exceeded");
        expect(first.release).toHaveBeenCalledOnce();
        const second = fixture();
        second.pyodide.runPythonAsync.mockResolvedValue(Number.NaN);
        expect(
            (await executePythonInWorker(second.runtime, execution, second.hostFetch)).stderr
        ).toContain("invalid exit code");
        expect(second.release).toHaveBeenCalledOnce();
    });
});
