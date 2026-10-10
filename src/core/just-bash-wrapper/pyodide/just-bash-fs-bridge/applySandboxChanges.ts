import type {IFileSystem} from "just-bash";
import type {SandboxChanges, SandboxSnapshot} from "../sandbox-tree/types";
import {
    compareByDepthAscending,
    compareByDepthDescending
} from "../sandbox-tree/utils/compareByDepth";
import {SandboxWriteBackAbortedError} from "./SandboxWriteBackAbortedError";
import type {WriteBackFailure} from "./types";
import {findSnapshotConflicts} from "./utils/findSnapshotConflicts";

/** Apply a Pyodide filesystem diff through the authoritative just-bash filesystem. */
export async function applySandboxChanges(
    filesystem: IFileSystem,
    changes: SandboxChanges,
    snapshot: SandboxSnapshot,
    signal?: AbortSignal
): Promise<WriteBackFailure[]> {
    const failures: WriteBackFailure[] = changes.unsupported.map(({path, reason}) => ({
        path,
        message: reason
    }));
    const canonicalRoot = filesystem.resolvePath("/", snapshot.root);
    const changedPaths = [
        ...changes.createdDirectories,
        ...changes.writtenFiles.map(({path}) => path),
        ...changes.deletedFiles,
        ...changes.deletedDirectories,
        ...changes.unsupported.map(({path}) => path)
    ];
    for (const path of changedPaths) {
        const canonicalPath = filesystem.resolvePath("/", path);
        if (path !== canonicalPath || !canonicalPath.startsWith(`${canonicalRoot}/`)) {
            failures.push({path, message: `path is outside the shared root ${snapshot.root}`});
        }
    }
    // Reject the whole diff before mutations: deleting beneath a rejected entry could lose data.
    if (failures.length > 0) return failures;
    failures.push(...(await findSnapshotConflicts(filesystem, changes, snapshot)));
    if (failures.length > 0) return failures;
    if (signal?.aborted) throw new SandboxWriteBackAbortedError();

    // Narrow the unavoidable check-to-commit window; storage has no transaction primitive.
    failures.push(...(await findSnapshotConflicts(filesystem, changes, snapshot)));
    if (failures.length > 0) return failures;
    if (signal?.aborted) throw new SandboxWriteBackAbortedError();
    const attempt = async (path: string, operation: () => Promise<void>) => {
        try {
            await operation();
        } catch (error) {
            failures.push({path, message: error instanceof Error ? error.message : String(error)});
        }
    };
    // Remove old types before replacements. Once commit starts, finish despite cancellation.
    for (const path of changes.deletedFiles) await attempt(path, () => filesystem.rm(path));
    for (const path of [...changes.deletedDirectories].sort(compareByDepthDescending)) {
        await attempt(path, () => filesystem.rm(path));
    }
    for (const path of [...changes.createdDirectories].sort(compareByDepthAscending)) {
        await attempt(path, () => filesystem.mkdir(path, {recursive: true}));
    }
    for (const {path, content} of changes.writtenFiles) {
        await attempt(path, () => filesystem.writeFile(path, content));
    }
    return failures;
}
