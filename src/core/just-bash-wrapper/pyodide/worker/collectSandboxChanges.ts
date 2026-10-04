import {
    assertFileWithinSnapshotBudget,
    assertTotalWithinSnapshotBudget
} from "../fs-bridge/sandboxFsLimits";
import type {SandboxChanges, SandboxSnapshot} from "../workerProtocol";
import type {PyodideFS} from "./pyodideFs";

/** Diff the Pyodide shared root against its input snapshot. */
export function collectSandboxChanges(
    filesystem: PyodideFS,
    snapshot: SandboxSnapshot
): SandboxChanges {
    const originalDirectories = new Set(snapshot.directories.map(({path}) => path));
    const originalFiles = new Map(snapshot.files.map(({path, content}) => [path, content]));
    const seenDirectories = new Set<string>();
    const seenFiles = new Set<string>();
    const createdDirectories: string[] = [];
    const writtenFiles: SandboxChanges["writtenFiles"] = [];
    const unsupported: SandboxChanges["unsupported"] = [];
    let totalBytes = 0;

    const visit = (path: string): void => {
        const stat = filesystem.lstat(path);
        if (filesystem.isLink(stat.mode)) {
            if (originalFiles.has(path)) seenFiles.add(path);
            if (originalDirectories.has(path)) seenDirectories.add(path);
            unsupported.push({path, reason: "symbolic links are not supported"});
            return;
        }
        if (filesystem.isDir(stat.mode)) {
            seenDirectories.add(path);
            if (path !== snapshot.root && !originalDirectories.has(path)) {
                createdDirectories.push(path);
            }
            for (const name of filesystem.readdir(path).sort()) {
                if (name !== "." && name !== "..") visit(`${path}/${name}`);
            }
            return;
        }
        if (!filesystem.isFile(stat.mode)) {
            unsupported.push({path, reason: "unsupported filesystem entry"});
            return;
        }

        seenFiles.add(path);
        const content = filesystem.readFile(path);
        const original = originalFiles.get(path);
        if (original && bytesEqual(original, content)) return;
        assertFileWithinSnapshotBudget(path, content.byteLength);
        totalBytes += content.byteLength;
        assertTotalWithinSnapshotBudget(totalBytes);
        writtenFiles.push({path, content});
    };

    visit(snapshot.root);
    return {
        createdDirectories: createdDirectories.sort(byDepthAscending),
        writtenFiles,
        deletedFiles: [...originalFiles.keys()].filter((path) => !seenFiles.has(path)).sort(),
        deletedDirectories: [...originalDirectories]
            .filter((path) => path !== snapshot.root && !seenDirectories.has(path))
            .sort(byDepthDescending),
        unsupported
    };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((value, index) => value === right[index]);
}

const byDepthAscending = (left: string, right: string): number => depth(left) - depth(right);
const byDepthDescending = (left: string, right: string): number => depth(right) - depth(left);
const depth = (path: string): number => path.split("/").length;
