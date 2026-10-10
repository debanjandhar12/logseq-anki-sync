// @vitest-environment node
import {releaseProxy} from "comlink";
import type {PyodideInterface} from "pyodide";
import {beforeEach, describe, expect, test, vi} from "vitest";
import type {SandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/types";
import {collectSandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/collectSandboxChanges";
import {createPythonGlobals} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createPythonGlobals";
import {executePythonInWorker} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/executePythonInWorker";
import {loadSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/loadSandboxSnapshot";
import type {
    PythonWorkerExecution,
    PythonWorkerFetch
} from "../../../../../../src/core/just-bash-wrapper/pyodide/workerProtocol";

const changes: SandboxChanges = {
    createdDirectories: [],
    writtenFiles: [],
    deletedFiles: [],
    deletedDirectories: [],
    unsupported: []
};

vi.mock("../../../../../../src/core/just-bash-wrapper/pyodide/worker/loadSandboxSnapshot", () => ({
    loadSandboxSnapshot: vi.fn()
}));
vi.mock(
    "../../../../../../src/core/just-bash-wrapper/pyodide/worker/collectSandboxChanges",
    () => ({collectSandboxChanges: vi.fn(() => changes)})
);

const execution: PythonWorkerExecution = {
    code: "print(2)",
    fileName: "test.py",
    args: [],
    stdin: "",
    cwd: "/work",
    env: {},
    snapshot: {root: "/home/user", entries: new Map()}
};

beforeEach(() => {
    vi.mocked(loadSandboxSnapshot).mockReset();
    vi.mocked(collectSandboxChanges).mockReset().mockReturnValue(changes);
});

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
    test("loads the snapshot before package loading and Python execution", async () => {
        const {pyodide, runtime, hostFetch} = fixture();
        await executePythonInWorker(runtime, execution, hostFetch);
        expect(loadSandboxSnapshot).toHaveBeenCalledWith(runtime.pyodide.FS, execution.snapshot);
        const loadOrder = vi.mocked(loadSandboxSnapshot).mock.invocationCallOrder[0];
        expect(loadOrder).toBeLessThan(pyodide.loadPackage.mock.invocationCallOrder[0]);
        expect(loadOrder).toBeLessThan(pyodide.runPython.mock.invocationCallOrder[0]);
        expect(loadOrder).toBeLessThan(pyodide.runPythonAsync.mock.invocationCallOrder[0]);
    });

    test("collects changes after Python execution fails if the snapshot was loaded", async () => {
        const {pyodide, runtime, hostFetch} = fixture();
        pyodide.runPythonAsync.mockRejectedValue(new Error("Python failed"));
        expect(await executePythonInWorker(runtime, execution, hostFetch)).toEqual({
            stdout: "",
            stderr: "Python failed\n",
            exitCode: 1,
            changes
        });
        expect(collectSandboxChanges).toHaveBeenCalledWith(runtime.pyodide.FS, execution.snapshot);
    });

    test("skips collection and cleans up when snapshot loading fails", async () => {
        const {pyodide, runtime, hostFetch, release} = fixture();
        vi.mocked(loadSandboxSnapshot).mockImplementation(() => {
            throw new Error("snapshot loading failed");
        });
        expect(await executePythonInWorker(runtime, execution, hostFetch)).toEqual({
            stdout: "",
            stderr: "snapshot loading failed\n",
            exitCode: 1
        });
        expect(collectSandboxChanges).not.toHaveBeenCalled();
        expect(pyodide.loadPackage).not.toHaveBeenCalled();
        expect(globalThis.fetch).toBe(runtime.originalFetch);
        expect(runtime.capabilities.globals.fetch).toBeUndefined();
        expect(release).toHaveBeenCalledOnce();
    });

    test("drops changes and preserves stdout when change collection fails", async () => {
        const {pyodide, runtime, hostFetch, release} = fixture();
        pyodide.setStdout.mockImplementation(({write}) => write(new TextEncoder().encode("2\n")));
        vi.mocked(collectSandboxChanges).mockImplementation(() => {
            throw new Error("collection failed");
        });
        expect(await executePythonInWorker(runtime, execution, hostFetch)).toEqual({
            stdout: "2\n",
            stderr: "python: cannot collect sandbox filesystem changes: collection failed\n",
            exitCode: 1
        });
        expect(globalThis.fetch).toBe(runtime.originalFetch);
        expect(runtime.capabilities.globals.fetch).toBeUndefined();
        expect(release).toHaveBeenCalledOnce();
    });

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
        await expect(executePythonInWorker(runtime, execution, hostFetch)).resolves.toEqual(
            expect.objectContaining({stdout: "", stderr: "setup failed\n", exitCode: 1})
        );
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
            exitCode: 0,
            changes
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
