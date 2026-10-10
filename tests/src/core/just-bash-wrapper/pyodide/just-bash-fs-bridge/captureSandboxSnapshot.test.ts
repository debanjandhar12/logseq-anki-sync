import {InMemoryFs, MountableFs} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {captureSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/captureSandboxSnapshot";
import {
    MAX_SANDBOX_SNAPSHOT_FILE_BYTES,
    MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES
} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/constants";
import {SandboxBudget} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/SandboxBudget";
import {ReadOnlyFileSystem} from "../../../../../../src/core/just-bash-wrapper/ReadOnlyFileSystem";
import {createSandboxSnapshot} from "../sandboxSnapshotFixture";

describe("captureSandboxSnapshot", () => {
    test("captures nested bytes and effective read-only modes", async () => {
        const base = new InMemoryFs();
        base.mkdirSync("/home/user/nested", {recursive: true});
        await base.writeFile("/home/user/nested/data.bin", new Uint8Array([0, 255, 1]));
        const filesystem = new MountableFs({base: new ReadOnlyFileSystem(base)});

        const snapshot = await captureSandboxSnapshot(filesystem, "/home/user");

        expect(snapshot).toEqual(
            createSandboxSnapshot("/home/user", {
                "/home/user": {kind: "directory", mode: 0o555},
                "/home/user/nested": {kind: "directory", mode: 0o555},
                "/home/user/nested/data.bin": {
                    kind: "file",
                    mode: 0o444,
                    content: new Uint8Array([0, 255, 1])
                }
            })
        );
    });

    test("fails before reading a file whose stat exceeds the per-file budget", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});
        await filesystem.writeFile("/home/user/large", Buffer.from("small"));
        const rootStat = await filesystem.lstat("/home/user");
        const fileStat = await filesystem.lstat("/home/user/large");
        const readFileBuffer = vi.spyOn(filesystem, "readFileBuffer");
        vi.spyOn(filesystem, "lstat")
            .mockResolvedValueOnce(rootStat)
            .mockResolvedValueOnce({...fileStat, size: MAX_SANDBOX_SNAPSHOT_FILE_BYTES + 1});

        await expect(captureSandboxSnapshot(filesystem, "/home/user")).rejects.toThrow(
            "16 MiB per-file limit"
        );
        expect(readFileBuffer).not.toHaveBeenCalled();
    });

    test("rejects symbolic links", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});
        await filesystem.writeFile("/home/user/target", Buffer.from("x"));
        await filesystem.symlink("/home/user/target", "/home/user/link");

        await expect(captureSandboxSnapshot(filesystem, "/home/user")).rejects.toThrow(
            "symbolic links are not supported"
        );
    });

    test("rejects aggregate snapshots over the total byte budget", () => {
        const budget = new SandboxBudget();
        for (
            let size = 0;
            size < MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES;
            size += MAX_SANDBOX_SNAPSHOT_FILE_BYTES
        ) {
            budget.add("/home/user/file", MAX_SANDBOX_SNAPSHOT_FILE_BYTES);
        }
        expect(() => budget.add("/home/user/extra", 1)).toThrow("128 MiB total limit");
    });
});
