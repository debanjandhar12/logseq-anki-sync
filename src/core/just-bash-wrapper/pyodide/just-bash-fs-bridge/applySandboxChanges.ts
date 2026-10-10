import type {IFileSystem} from "just-bash";
import type {SandboxChanges, SandboxSnapshot} from "../workerProtocol";

import {SandboxWriteBackAbortedError} from "./utils/SandboxWriteBackAbortedError";
import type {WriteBackFailure} from "./utils/WriteBackFailure";

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
    for (const path of changedPaths(changes)) {
        const canonicalPath = filesystem.resolvePath("/", path);
        if (path !== canonicalPath || !canonicalPath.startsWith(`${canonicalRoot}/`)) {
            failures.push({path, message: `path is outside the shared root ${snapshot.root}`});
        }
    }
    // Unsupported or untrusted entries make the diff indivisible. Applying the
    // remaining operations could otherwise delete data beneath a rejected entry.
    if (failures.length > 0) return failures;

    failures.push(...(await findSnapshotConflicts(filesystem, changes, snapshot)));
    if (failures.length > 0) return failures;
    if (signal?.aborted) throw new SandboxWriteBackAbortedError();

    // Narrow the unavoidable check-to-commit window. Storage has no revision or
    // transaction primitive, so this is optimistic concurrency control.
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

    // Remove old entry types before creating replacements at the same path.
    for (const path of changes.deletedFiles) {
        await attempt(path, () => filesystem.rm(path));
    }
    for (const path of [...changes.deletedDirectories].sort(byDepthDescending)) {
        await attempt(path, () => filesystem.rm(path));
    }
    for (const path of [...changes.createdDirectories].sort(byDepthAscending)) {
        await attempt(path, () => filesystem.mkdir(path, {recursive: true}));
    }
    for (const {path, content} of changes.writtenFiles) {
        await attempt(path, () => filesystem.writeFile(path, content));
    }
    return failures;
}

async function findSnapshotConflicts(
    filesystem: IFileSystem,
    changes: SandboxChanges,
    snapshot: SandboxSnapshot
): Promise<WriteBackFailure[]> {
    const originalFiles = new Map(snapshot.files.map(({path, content}) => [path, content]));
    const originalDirectories = new Set(snapshot.directories.map(({path}) => path));
    const directlyAffectedPaths = [
        ...changes.deletedFiles,
        ...changes.deletedDirectories,
        ...changes.createdDirectories,
        ...changes.writtenFiles.map(({path}) => path)
    ];
    const affectedPaths = new Set(directlyAffectedPaths);
    for (const path of directlyAffectedPaths) {
        for (const ancestor of ancestorsWithinRoot(path, snapshot.root))
            affectedPaths.add(ancestor);
    }
    const failures: WriteBackFailure[] = [];

    for (const path of affectedPaths) {
        try {
            const exists = await filesystem.exists(path);
            const originalFile = originalFiles.get(path);
            const originalDirectory = originalDirectories.has(path);
            if (!originalFile && !originalDirectory) {
                if (exists) failures.push(conflict(path));
                continue;
            }
            if (!exists) {
                failures.push(conflict(path));
                continue;
            }
            const stat = await filesystem.lstat(path);
            if (originalFile) {
                if (
                    !stat.isFile ||
                    !bytesEqual(originalFile, await filesystem.readFileBuffer(path))
                ) {
                    failures.push(conflict(path));
                }
            } else if (!stat.isDirectory) {
                failures.push(conflict(path));
            } else if (
                changes.deletedDirectories.includes(path) &&
                !sameEntries(await filesystem.readdir(path), snapshotChildren(path, snapshot))
            ) {
                failures.push(conflict(path));
            }
        } catch (error) {
            failures.push({path, message: error instanceof Error ? error.message : String(error)});
        }
    }
    return failures;
}

function ancestorsWithinRoot(path: string, root: string): string[] {
    const ancestors: string[] = [];
    let ancestor = path.slice(0, path.lastIndexOf("/"));
    while (ancestor.length >= root.length) {
        ancestors.push(ancestor);
        if (ancestor === root) break;
        ancestor = ancestor.slice(0, ancestor.lastIndexOf("/"));
    }
    return ancestors;
}

function snapshotChildren(path: string, snapshot: SandboxSnapshot): string[] {
    const prefix = `${path}/`;
    return [...snapshot.directories.map(({path}) => path), ...snapshot.files.map(({path}) => path)]
        .filter((entry) => entry.startsWith(prefix) && !entry.slice(prefix.length).includes("/"))
        .map((entry) => entry.slice(prefix.length))
        .sort();
}

function sameEntries(left: string[], right: string[]): boolean {
    const sortedLeft = [...left].sort();
    return (
        sortedLeft.length === right.length &&
        sortedLeft.every((value, index) => value === right[index])
    );
}

function changedPaths(changes: SandboxChanges): string[] {
    return [
        ...changes.createdDirectories,
        ...changes.writtenFiles.map(({path}) => path),
        ...changes.deletedFiles,
        ...changes.deletedDirectories,
        ...changes.unsupported.map(({path}) => path)
    ];
}

function conflict(path: string): WriteBackFailure {
    return {path, message: "filesystem changed after the Python snapshot was captured"};
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((value, index) => value === right[index]);
}

const byDepthAscending = (left: string, right: string): number => depth(left) - depth(right);
const byDepthDescending = (left: string, right: string): number => depth(right) - depth(left);
const depth = (path: string): number => path.split("/").length;
