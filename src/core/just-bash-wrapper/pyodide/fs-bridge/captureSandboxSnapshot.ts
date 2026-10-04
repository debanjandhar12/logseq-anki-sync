import type {IFileSystem} from "just-bash";
import type {SandboxSnapshot} from "../workerProtocol";
import {
    assertFileWithinSnapshotBudget,
    assertTotalWithinSnapshotBudget,
    SandboxSnapshotError
} from "./sandboxFsLimits";

/** Capture one virtual filesystem subtree for materialization inside Pyodide. */
export async function captureSandboxSnapshot(
    filesystem: IFileSystem,
    root: string
): Promise<SandboxSnapshot> {
    const resolvedRoot = filesystem.resolvePath("/", root);
    const directories: SandboxSnapshot["directories"] = [];
    const files: SandboxSnapshot["files"] = [];
    let totalBytes = 0;

    async function visit(path: string): Promise<void> {
        const stat = await filesystem.lstat(path);
        if (stat.isSymbolicLink) {
            throw new SandboxSnapshotError(`symbolic links are not supported: ${path}`);
        }
        if (stat.isDirectory) {
            directories.push({path, mode: stat.mode & 0o777});
            for (const name of (await filesystem.readdir(path)).sort()) {
                await visit(path === "/" ? `/${name}` : `${path}/${name}`);
            }
            return;
        }
        if (!stat.isFile) throw new SandboxSnapshotError(`unsupported filesystem entry: ${path}`);

        assertFileWithinSnapshotBudget(path, stat.size);
        assertTotalWithinSnapshotBudget(totalBytes + stat.size);
        const content = await filesystem.readFileBuffer(path);
        assertFileWithinSnapshotBudget(path, content.byteLength);
        totalBytes += content.byteLength;
        assertTotalWithinSnapshotBudget(totalBytes);
        files.push({path, mode: stat.mode & 0o777, content});
    }

    await visit(resolvedRoot);
    return {root: resolvedRoot, directories, files};
}
