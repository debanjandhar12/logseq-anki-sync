import {InMemoryFs} from "just-bash";
import {describe, expect, test, vi} from "vitest";
import {applySandboxChanges} from "../../../../../../src/core/just-bash-wrapper/pyodide/fs-bridge/applySandboxChanges";

const emptySnapshot = {
    root: "/home/user",
    directories: [{path: "/home/user", mode: 0o777}],
    files: []
};

import {ReadOnlyFileSystem} from "../../../../../../src/core/just-bash-wrapper/ReadOnlyFileSystem";

describe("applySandboxChanges", () => {
    test("applies creates, writes, deletions and type replacements", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user/old-directory", {recursive: true});
        await filesystem.writeFile("/home/user/old-directory/child", Buffer.from("old"));
        await filesystem.writeFile("/home/user/old-file", Buffer.from("old"));

        await expect(
            applySandboxChanges(
                filesystem,
                {
                    createdDirectories: ["/home/user/old-file"],
                    writtenFiles: [
                        {path: "/home/user/old-file/new", content: Buffer.from("new")},
                        {
                            path: "/home/user/old-directory",
                            content: Buffer.from("replacement")
                        }
                    ],
                    deletedFiles: ["/home/user/old-file", "/home/user/old-directory/child"],
                    deletedDirectories: ["/home/user/old-directory"],
                    unsupported: []
                },
                {
                    ...emptySnapshot,
                    directories: [
                        ...emptySnapshot.directories,
                        {path: "/home/user/old-directory", mode: 0o755}
                    ],
                    files: [
                        {path: "/home/user/old-file", mode: 0o644, content: Buffer.from("old")},
                        {
                            path: "/home/user/old-directory/child",
                            mode: 0o644,
                            content: Buffer.from("old")
                        }
                    ]
                }
            )
        ).resolves.toEqual([]);
        await expect(filesystem.readFile("/home/user/old-file/new")).resolves.toBe("new");
        await expect(filesystem.readFile("/home/user/old-directory")).resolves.toBe("replacement");
    });

    test("collects failures without stopping later operations", async () => {
        const base = new InMemoryFs();
        base.mkdirSync("/home/user", {recursive: true});
        const filesystem = new ReadOnlyFileSystem(base);

        const failures = await applySandboxChanges(
            filesystem,
            {
                createdDirectories: ["/home/user/directory"],
                writtenFiles: [{path: "/home/user/file", content: new Uint8Array()}],
                deletedFiles: [],
                deletedDirectories: [],
                unsupported: [{path: "/home/user/link", reason: "symbolic links are not supported"}]
            },
            emptySnapshot
        );

        expect(failures).toEqual([
            {path: "/home/user/link", message: "symbolic links are not supported"}
        ]);
        await expect(base.exists("/home/user/directory")).resolves.toBe(false);
        await expect(base.exists("/home/user/file")).resolves.toBe(false);
    });

    test("rejects the entire diff when the host changed after capture", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});
        await filesystem.writeFile("/home/user/file", Buffer.from("new host value"));

        const failures = await applySandboxChanges(
            filesystem,
            {
                createdDirectories: ["/home/user/generated"],
                writtenFiles: [{path: "/home/user/file", content: Buffer.from("python value")}],
                deletedFiles: [],
                deletedDirectories: [],
                unsupported: []
            },
            {
                ...emptySnapshot,
                files: [{path: "/home/user/file", mode: 0o644, content: Buffer.from("snapshot")}]
            }
        );

        expect(failures).toEqual([
            {
                path: "/home/user/file",
                message: "filesystem changed after the Python snapshot was captured"
            }
        ]);
        await expect(filesystem.readFile("/home/user/file")).resolves.toBe("new host value");
        await expect(filesystem.exists("/home/user/generated")).resolves.toBe(false);
    });

    test("rejects non-canonical and out-of-root changed paths", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});

        const failures = await applySandboxChanges(
            filesystem,
            {
                createdDirectories: [],
                writtenFiles: [{path: "/home/user/../outside", content: Buffer.from("outside")}],
                deletedFiles: [],
                deletedDirectories: [],
                unsupported: []
            },
            emptySnapshot
        );

        expect(failures).toEqual([
            {
                path: "/home/user/../outside",
                message: "path is outside the shared root /home/user"
            }
        ]);
        await expect(filesystem.exists("/home/outside")).resolves.toBe(false);
    });

    test("rejects the diff when an affected ancestor changed type", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});
        await filesystem.writeFile("/home/user/directory", Buffer.from("replacement"));

        const failures = await applySandboxChanges(
            filesystem,
            {
                createdDirectories: [],
                writtenFiles: [
                    {path: "/home/user/directory/new.txt", content: Buffer.from("python")}
                ],
                deletedFiles: [],
                deletedDirectories: [],
                unsupported: []
            },
            {
                ...emptySnapshot,
                directories: [
                    ...emptySnapshot.directories,
                    {path: "/home/user/directory", mode: 0o755}
                ]
            }
        );

        expect(failures).toEqual([
            {
                path: "/home/user/directory",
                message: "filesystem changed after the Python snapshot was captured"
            }
        ]);
        await expect(filesystem.readFile("/home/user/directory")).resolves.toBe("replacement");
    });

    test("aborts after asynchronous validation without starting the commit", async () => {
        const filesystem = new InMemoryFs();
        filesystem.mkdirSync("/home/user", {recursive: true});
        const controller = new AbortController();
        const exists = filesystem.exists.bind(filesystem);
        vi.spyOn(filesystem, "exists").mockImplementation(async (path) => {
            if (path === "/home/user/generated") controller.abort();
            return exists(path);
        });

        await expect(
            applySandboxChanges(
                filesystem,
                {
                    createdDirectories: ["/home/user/generated"],
                    writtenFiles: [],
                    deletedFiles: [],
                    deletedDirectories: [],
                    unsupported: []
                },
                emptySnapshot,
                controller.signal
            )
        ).rejects.toThrow("execution aborted before filesystem write-back");
        await expect(filesystem.exists("/home/user/generated")).resolves.toBe(false);
    });
});
