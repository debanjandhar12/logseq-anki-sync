import type {IFileSystem} from "just-bash";
import {SandboxBudget} from "../sandbox-tree/SandboxBudget";
import {SandboxSnapshotError} from "../sandbox-tree/SandboxSnapshotError";
import type {SandboxEntry, SandboxSnapshot} from "../sandbox-tree/types";
import {joinSandboxPath} from "../sandbox-tree/utils/joinSandboxPath";
import {readHostEntry} from "./utils/readHostEntry";

/** Capture one virtual filesystem subtree for materialization inside Pyodide. */
export async function captureSandboxSnapshot(
    filesystem: IFileSystem,
    rootPath: string
): Promise<SandboxSnapshot> {
    const root = filesystem.resolvePath("/", rootPath);
    const entries = new Map<string, SandboxEntry>();
    const budget = new SandboxBudget();
    async function visit(path: string): Promise<void> {
        const entry = await readHostEntry(filesystem, path, budget);
        if (!entry) throw new SandboxSnapshotError(`missing filesystem entry: ${path}`);
        entries.set(path, entry);
        if (entry.kind !== "directory") return;
        for (const name of (await filesystem.readdir(path)).sort())
            await visit(joinSandboxPath(path, name));
    }
    await visit(root);
    return {root, entries};
}
