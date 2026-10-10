// @vitest-environment node
import {loadPyodide, type PyodideInterface} from "pyodide";
import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {MAX_SANDBOX_SNAPSHOT_FILE_BYTES} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/constants";
import {collectSandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/collectSandboxChanges";
import {loadSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/loadSandboxSnapshot";
import type {PyodideFS} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/pyodideFs";
import type {SandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/workerProtocol";

let pyodide: PyodideInterface;
let filesystem: PyodideFS;

const snapshot: SandboxSnapshot = {
    root: "/home/user",
    directories: [
        {path: "/home/user", mode: 0o555},
        {path: "/home/user/readonly", mode: 0o555},
        {path: "/home/user/writable", mode: 0o777},
        {path: "/home/user/writable/remove", mode: 0o777}
    ],
    files: [
        {
            path: "/home/user/readonly/input.json",
            mode: 0o444,
            content: new TextEncoder().encode('{"value":2}')
        },
        {
            path: "/home/user/writable/change.txt",
            mode: 0o666,
            content: new TextEncoder().encode("before")
        },
        {
            path: "/home/user/writable/remove/file.txt",
            mode: 0o666,
            content: new TextEncoder().encode("remove")
        }
    ]
};

beforeAll(async () => {
    const require = process.getBuiltinModule("module").createRequire(import.meta.url);
    const {dirname} = process.getBuiltinModule("path");
    pyodide = await loadPyodide({indexURL: dirname(require.resolve("pyodide/pyodide.asm.wasm"))});
    filesystem = pyodide.FS;
}, 30_000);

beforeEach(() => loadSandboxSnapshot(filesystem, snapshot));

describe("Pyodide sandbox snapshots", () => {
    test("reloading replaces stale contents and restores original bytes and modes", () => {
        pyodide.runPython(`
import os
os.chmod('/home/user/readonly/input.json', 0o666)
open('/home/user/readonly/input.json', 'w').write('changed')
open('/home/user/writable/stale.txt', 'w').write('stale')
os.chmod('/home/user/readonly', 0o777)
`);

        loadSandboxSnapshot(filesystem, snapshot);

        expect(filesystem.analyzePath("/home/user/writable/stale.txt").exists).toBe(false);
        expect(filesystem.readFile("/home/user/readonly/input.json")).toEqual(
            snapshot.files[0].content
        );
        expect(filesystem.lstat("/home/user/readonly/input.json").mode & 0o777).toBe(0o444);
        expect(filesystem.lstat("/home/user/readonly").mode & 0o777).toBe(0o555);
        expect(collectSandboxChanges(filesystem, snapshot)).toEqual({
            createdDirectories: [],
            writtenFiles: [],
            deletedFiles: [],
            deletedDirectories: [],
            unsupported: []
        });
    });

    test("supports ordinary Python reads and enforces read-only mode bits", () => {
        expect(
            pyodide
                .runPython(
                    `import json, os
value = json.load(open('/home/user/readonly/input.json'))['value']
entries = sorted(os.listdir('/home/user'))
(value, entries)`
                )
                .toJs()
        ).toEqual([2, ["readonly", "writable"]]);
        expect(() =>
            pyodide.runPython("open('/home/user/readonly/new.txt', 'w').write('x')")
        ).toThrow("PermissionError");
    });

    test("collects byte-level creates, modifications and recursive deletions", () => {
        pyodide.runPython(`
import os
open('/home/user/writable/change.txt', 'w').write('after')
os.makedirs('/home/user/writable/new/nested')
open('/home/user/writable/new/nested/file.bin', 'wb').write(bytes([0, 255, 1]))
os.remove('/home/user/writable/remove/file.txt')
os.rmdir('/home/user/writable/remove')
`);

        const changes = collectSandboxChanges(filesystem, snapshot);
        expect(changes.createdDirectories).toEqual([
            "/home/user/writable/new",
            "/home/user/writable/new/nested"
        ]);
        expect(changes.writtenFiles).toEqual([
            {
                path: "/home/user/writable/change.txt",
                content: new TextEncoder().encode("after")
            },
            {
                path: "/home/user/writable/new/nested/file.bin",
                content: new Uint8Array([0, 255, 1])
            }
        ]);
        expect(changes.deletedFiles).toEqual(["/home/user/writable/remove/file.txt"]);
        expect(changes.deletedDirectories).toEqual(["/home/user/writable/remove"]);
    });

    test("detects chmod bypasses and reports symlinks without following them", () => {
        pyodide.runPython(`
import os
os.chmod('/home/user/readonly', 0o777)
open('/home/user/readonly/bypass.txt', 'w').write('bypass')
os.symlink('/home/user/readonly/input.json', '/home/user/writable/link')
`);

        const changes = collectSandboxChanges(filesystem, snapshot);
        expect(changes.writtenFiles).toEqual([
            {
                path: "/home/user/readonly/bypass.txt",
                content: new TextEncoder().encode("bypass")
            }
        ]);
        expect(changes.unsupported).toEqual([
            {path: "/home/user/writable/link", reason: "symbolic links are not supported"}
        ]);
    });

    test("fails rather than returning a partial diff when output exceeds the budget", () => {
        const oversized = new Uint8Array(MAX_SANDBOX_SNAPSHOT_FILE_BYTES + 1);
        filesystem.writeFile("/home/user/writable/large.bin", oversized);
        expect(() => collectSandboxChanges(filesystem, snapshot)).toThrow("16 MiB per-file limit");
    });
});
