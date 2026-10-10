// @vitest-environment node
import {describe, expect, test} from "vitest";
import {diffSandboxTrees} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/diffSandboxTrees";
import type {SandboxEntry} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/types";
import {createSandboxSnapshot} from "../sandboxSnapshotFixture";

const directory: SandboxEntry = {kind: "directory", mode: 0o777};
const file = (text: string, mode = 0o666): SandboxEntry => ({
    kind: "file",
    mode,
    content: new TextEncoder().encode(text)
});
const snapshot = (entries: Record<string, SandboxEntry>) =>
    createSandboxSnapshot("/home/user", {
        "/home/user": directory,
        ...entries
    });

describe("diffSandboxTrees", () => {
    test("compares bytes, ignores modes and records file/directory type replacements", () => {
        const before = snapshot({
            "/home/user/unchanged": file("same"),
            "/home/user/changed": file("before"),
            "/home/user/to-directory": file("old"),
            "/home/user/to-file": directory
        });
        const after = snapshot({
            "/home/user/unchanged": file("same", 0o444),
            "/home/user/changed": file("after"),
            "/home/user/to-directory": directory,
            "/home/user/to-file": file("new")
        });
        expect(diffSandboxTrees(before, after)).toEqual({
            createdDirectories: ["/home/user/to-directory"],
            writtenFiles: [
                {path: "/home/user/changed", content: new TextEncoder().encode("after")},
                {path: "/home/user/to-file", content: new TextEncoder().encode("new")}
            ],
            deletedFiles: ["/home/user/to-directory"],
            deletedDirectories: ["/home/user/to-file"]
        });
    });

    test("orders nested creates and deletes while never deleting the root", () => {
        const tree = snapshot({
            "/home/user/a/b/file": file("new"),
            "/home/user/a/b": directory,
            "/home/user/a": directory
        });
        const empty = createSandboxSnapshot("/home/user", {});
        expect(diffSandboxTrees(empty, tree).createdDirectories).toEqual([
            "/home/user/a",
            "/home/user/a/b"
        ]);
        expect(diffSandboxTrees(tree, empty)).toEqual({
            createdDirectories: [],
            writtenFiles: [],
            deletedFiles: ["/home/user/a/b/file"],
            deletedDirectories: ["/home/user/a/b", "/home/user/a"]
        });
    });

    test("preserves unsupported paths and survives structured cloning", () => {
        const before = snapshot({"/home/user/link": file("old"), "/home/user/empty": file("")});
        const next = snapshot({"/home/user/empty": file("")});
        expect(
            diffSandboxTrees(structuredClone(before), next, new Set(["/home/user/link"]))
        ).toEqual({
            createdDirectories: [],
            writtenFiles: [],
            deletedFiles: [],
            deletedDirectories: []
        });
    });
});
