import {InMemoryFs, MountableFs} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {captureSandboxSnapshot} from "../../../../../../src/core/just-bash-wrapper/pyodide/fs-bridge/captureSandboxSnapshot";
import {
    assertTotalWithinSnapshotBudget,
    MAX_SANDBOX_SNAPSHOT_FILE_BYTES,
    MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES
} from "../../../../../../src/core/just-bash-wrapper/pyodide/fs-bridge/sandboxFsLimits";
import {ReadOnlyFileSystem} from "../../../../../../src/core/just-bash-wrapper/ReadOnlyFileSystem";

describe("captureSandboxSnapshot", () => {
    test("captures nested bytes and effective read-only modes", async () => {
        const base = new InMemoryFs();
        base.mkdirSync("/home/user/nested", {recursive: true});
        await base.writeFile("/home/user/nested/data.bin", new Uint8Array([0, 255, 1]));
        const filesystem = new MountableFs({base: new ReadOnlyFileSystem(base)});

        const snapshot = await captureSandboxSnapshot(filesystem, "/home/user");

        expect(snapshot.directories).toEqual([
            {path: "/home/user", mode: 0o555},
            {path: "/home/user/nested", mode: 0o555}
        ]);
        expect(snapshot.files).toEqual([
            {
                path: "/home/user/nested/data.bin",
                mode: 0o444,
                content: new Uint8Array([0, 255, 1])
            }
        ]);
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
        expect(() => assertTotalWithinSnapshotBudget(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES + 1)).toThrow(
            "128 MiB total limit"
        );
    });
});
