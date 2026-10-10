// @vitest-environment node
import {describe, expect, test, vi} from "vitest";
import {MAX_SANDBOX_SNAPSHOT_FILE_BYTES} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/constants";
import type {SandboxEntry} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/types";
import {collectSandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/collectSandboxChanges";
import type {PyodideFS} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/pyodideFs";
import {createSandboxSnapshot} from "../sandboxSnapshotFixture";

function filesystemWithFiles(files: Record<string, Uint8Array>) {
    const readFile = vi.fn((path: string) => files[path]);
    const filesystem = {
        lstat: (path: string) => ({mode: path === "/home/user" ? 0o40777 : 0o100666}),
        isLink: () => false,
        isDir: (mode: number) => (mode & 0o170000) === 0o40000,
        isFile: (mode: number) => (mode & 0o170000) === 0o100000,
        readdir: () => [
            ".",
            "..",
            ...Object.keys(files).map((path) => path.slice("/home/user/".length))
        ],
        readFile
    } as unknown as PyodideFS;
    return {filesystem, readFile};
}

describe("changed-file budget during traversal", () => {
    test("stops reading immediately after an oversized changed file", () => {
        const {filesystem, readFile} = filesystemWithFiles({
            "/home/user/a": new Uint8Array(MAX_SANDBOX_SNAPSHOT_FILE_BYTES + 1),
            "/home/user/b": new Uint8Array([1])
        });
        expect(() =>
            collectSandboxChanges(filesystem, createSandboxSnapshot("/home/user", {}))
        ).toThrow("16 MiB per-file limit");
        expect(readFile.mock.calls).toEqual([["/home/user/a"]]);
    });

    test("stops at the aggregate limit and does not charge unchanged files", () => {
        // Reuse one allocation to exercise aggregate accounting without allocating a 160 MiB tree.
        const content = new Uint8Array(MAX_SANDBOX_SNAPSHOT_FILE_BYTES);
        const files = Object.fromEntries(
            Array.from({length: 10}, (_, index) => [`/home/user/${index}`, content])
        );
        const {filesystem, readFile} = filesystemWithFiles(files);
        expect(() =>
            collectSandboxChanges(filesystem, createSandboxSnapshot("/home/user", {}))
        ).toThrow("128 MiB total limit");
        expect(readFile).toHaveBeenCalledTimes(9);
        expect(readFile).not.toHaveBeenCalledWith("/home/user/9");

        const entries = Object.fromEntries(
            Object.entries(files)
                .slice(0, 8)
                .map(([path, bytes]): [string, SandboxEntry] => [
                    path,
                    {kind: "file", mode: 0o666, content: bytes}
                ])
        );
        const changes = collectSandboxChanges(
            filesystem,
            createSandboxSnapshot("/home/user", entries)
        );
        expect(changes.writtenFiles.map(({path}) => path)).toEqual([
            "/home/user/8",
            "/home/user/9"
        ]);
    });
});
