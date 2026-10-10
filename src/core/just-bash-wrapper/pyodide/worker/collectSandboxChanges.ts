import {diffSandboxTrees} from "../sandbox-tree/diffSandboxTrees";
import {SandboxBudget} from "../sandbox-tree/SandboxBudget";
import type {SandboxChanges, SandboxSnapshot} from "../sandbox-tree/types";
import {isSameEntry} from "../sandbox-tree/utils/isSameEntry";
import type {PyodideFS} from "./pyodideFs";
import {readEmscriptenTree} from "./readEmscriptenTree";

/** Collect an indivisible, budget-checked diff of the shared root. */
export function collectSandboxChanges(
    filesystem: PyodideFS,
    snapshot: SandboxSnapshot
): SandboxChanges {
    const budget = new SandboxBudget();
    const {tree, unsupported} = readEmscriptenTree(filesystem, snapshot.root, (path, entry) => {
        if (!isSameEntry(snapshot.entries.get(path), entry))
            budget.add(path, entry.content.byteLength);
    });
    const changes = diffSandboxTrees(snapshot, tree, new Set(unsupported.map(({path}) => path)));
    return {...changes, unsupported};
}
