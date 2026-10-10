import type {IFileSystem} from "just-bash";
import type {SandboxBudget} from "../../sandbox-tree/SandboxBudget";
import {SandboxSnapshotError} from "../../sandbox-tree/SandboxSnapshotError";
import type {SandboxEntry} from "../../sandbox-tree/types";

/** Read a single entry without following symbolic links. */
export async function readHostEntry(
    filesystem: IFileSystem,
    path: string,
    budget?: SandboxBudget
): Promise<SandboxEntry | undefined> {
    if (!(await filesystem.exists(path))) return undefined;
    const stat = await filesystem.lstat(path);
    if (stat.isSymbolicLink)
        throw new SandboxSnapshotError(`symbolic links are not supported: ${path}`);
    const mode = stat.mode & 0o777;
    if (stat.isDirectory) return {kind: "directory", mode};
    if (!stat.isFile) throw new SandboxSnapshotError(`unsupported filesystem entry: ${path}`);
    budget?.assertCanAdd(path, stat.size);
    const content = await filesystem.readFileBuffer(path);
    budget?.add(path, content.byteLength);
    return {kind: "file", mode, content};
}
