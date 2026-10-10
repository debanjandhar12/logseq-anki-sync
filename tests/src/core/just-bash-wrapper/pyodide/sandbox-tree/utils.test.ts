// @vitest-environment node
import {expect, test} from "vitest";
import {joinSandboxPath} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/utils/joinSandboxPath";
import {listAncestorsWithinRoot} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/utils/listAncestorsWithinRoot";
import {listSnapshotChildren} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/utils/listSnapshotChildren";
import {createSandboxSnapshot} from "../sandboxSnapshotFixture";

test("path helpers respect root boundaries and direct children", () => {
    expect(joinSandboxPath("/", "a")).toBe("/a");
    expect(listAncestorsWithinRoot("/home/user/a/file", "/home/user")).toEqual([
        "/home/user/a",
        "/home/user"
    ]);
    expect(listAncestorsWithinRoot("/home/username/file", "/home/user")).toEqual([]);
    expect(listAncestorsWithinRoot("/a/file", "/")).toEqual(["/a", "/"]);
    const directory = {kind: "directory" as const, mode: 0o777};
    const tree = createSandboxSnapshot("/", {
        "/": directory,
        "/b": directory,
        "/a": directory,
        "/a/nested": directory
    });
    expect(listSnapshotChildren(tree, "/")).toEqual(["a", "b"]);
    expect(listSnapshotChildren(tree, "/a")).toEqual(["nested"]);
});
