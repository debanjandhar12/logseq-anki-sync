import type {SandboxSnapshot} from "../sandbox-tree/types";
import {compareByDepthDescending} from "../sandbox-tree/utils/compareByDepth";
import type {PyodideFS} from "./PyodideFS";

const SNAPSHOT_MTIME_MS = 0;

/** Replace the Pyodide view of the shared root with an exact host snapshot. */
export function loadSandboxSnapshot(filesystem: PyodideFS, snapshot: SandboxSnapshot): void {
    if (filesystem.analyzePath(snapshot.root).exists) {
        clearDirectory(filesystem, snapshot.root);
    } else {
        filesystem.mkdirTree(snapshot.root);
    }

    for (const [path, entry] of snapshot.entries) {
        if (entry.kind === "directory") filesystem.mkdirTree(path);
    }
    for (const [path, entry] of snapshot.entries) {
        if (entry.kind !== "file") continue;
        filesystem.writeFile(path, entry.content);
        filesystem.utime(path, SNAPSHOT_MTIME_MS, SNAPSHOT_MTIME_MS);
        filesystem.chmod(path, entry.mode);
    }
    for (const path of [...snapshot.entries.keys()].sort(compareByDepthDescending)) {
        const entry = snapshot.entries.get(path)!;
        if (entry.kind === "directory") filesystem.chmod(path, entry.mode);
    }
}

function clearDirectory(filesystem: PyodideFS, path: string): void {
    filesystem.chmod(path, 0o777);
    for (const name of filesystem.readdir(path)) {
        if (name === "." || name === "..") continue;
        const childPath = `${path}/${name}`;
        const stat = filesystem.lstat(childPath);
        if (filesystem.isDir(stat.mode)) {
            clearDirectory(filesystem, childPath);
            filesystem.rmdir(childPath);
        } else {
            filesystem.unlink(childPath);
        }
    }
}
