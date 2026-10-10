// @vitest-environment node

import {InMemoryFs, MountableFs} from "just-bash";
import {loadPyodide, type PyodideInterface} from "pyodide";
import {beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import {JustBashAdapterFS} from "../../../../../../src/core/just-bash-wrapper/JustBashAdapterFS";
import {applySandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/applySandboxChanges";
import {captureSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/captureSandboxSnapshot";
import {MAX_SANDBOX_SNAPSHOT_FILE_BYTES} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/constants";
import {collectSandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/collectSandboxChanges";
import {loadSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/loadSandboxSnapshot";
import type {PyodideFS} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/pyodideFs";
import {ReadOnlyFileSystem} from "../../../../../../src/core/just-bash-wrapper/ReadOnlyFileSystem";
import {LogseqPluginStorageManager} from "../../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";
import {createSandboxSnapshot} from "../sandboxSnapshotFixture";

let pyodide: PyodideInterface;
let filesystem: PyodideFS;

// The storage-backed round trip uses InMemoryStore, without a browser Logseq host.
vi.mock("@logseq/libs", () => {
    vi.stubGlobal("logseq", {settings: {}});
    return {};
});

const snapshot = createSandboxSnapshot("/home/user", {
    "/home/user": {kind: "directory", mode: 0o555},
    "/home/user/readonly": {kind: "directory", mode: 0o555},
    "/home/user/writable": {kind: "directory", mode: 0o777},
    "/home/user/writable/remove": {kind: "directory", mode: 0o777},
    "/home/user/readonly/input.json": {
        kind: "file",
        mode: 0o444,
        content: new TextEncoder().encode('{"value":2}')
    },
    "/home/user/writable/change.txt": {
        kind: "file",
        mode: 0o666,
        content: new TextEncoder().encode("before")
    },
    "/home/user/writable/remove/file.txt": {
        kind: "file",
        mode: 0o666,
        content: new TextEncoder().encode("remove")
    }
});

beforeAll(async () => {
    const require = process.getBuiltinModule("module").createRequire(import.meta.url);
    const {dirname} = process.getBuiltinModule("path");
    pyodide = await loadPyodide({indexURL: dirname(require.resolve("pyodide/pyodide.asm.wasm"))});
    filesystem = pyodide.FS;
}, 30_000);

beforeEach(() => loadSandboxSnapshot(filesystem, snapshot));

describe("Pyodide sandbox snapshots", () => {
    test("round-trips Python writes through a readwrite storage mount", async () => {
        const previousStore = LogseqPluginStorageManager.store;
        LogseqPluginStorageManager.store = new InMemoryStore("pyodide-roundtrip");
        try {
            const base = new InMemoryFs();
            base.mkdirSync("/home/user", {recursive: true});
            const host = new MountableFs({
                base: new ReadOnlyFileSystem(base),
                mounts: [
                    {
                        mountPoint: "/home/user/scratch",
                        filesystem: new JustBashAdapterFS("scratch", "readwrite")
                    }
                ]
            });
            await host.writeFile("/home/user/scratch/input.txt", "before");
            const baseline = structuredClone(await captureSandboxSnapshot(host, "/home/user"));
            loadSandboxSnapshot(filesystem, baseline);
            pyodide.runPython(`
import os
open('/home/user/scratch/input.txt', 'w').write('after')
os.mkdir('/home/user/scratch/nested')
open('/home/user/scratch/nested/output.txt', 'w').write('café')
`);
            await expect(
                applySandboxChanges(host, collectSandboxChanges(filesystem, baseline), baseline)
            ).resolves.toEqual([]);
            await expect(
                LogseqPluginStorageManager.getFileContent("scratch", "input.txt")
            ).resolves.toBe("after");
            await expect(host.readFile("/home/user/scratch/nested/output.txt")).resolves.toBe(
                "café"
            );
        } finally {
            LogseqPluginStorageManager.store = previousStore;
        }
    });
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
            new TextEncoder().encode('{"value":2}')
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
