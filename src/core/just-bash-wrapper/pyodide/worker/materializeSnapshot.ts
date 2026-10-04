import type {SandboxSnapshot} from "../workerProtocol";
import type {PyodideFS} from "./pyodideFs";

const SNAPSHOT_MTIME_MS = 0;

/** Replace the Pyodide view of the shared root with an exact host snapshot. */
export function materializeSnapshot(filesystem: PyodideFS, snapshot: SandboxSnapshot): void {
    if (filesystem.analyzePath(snapshot.root).exists) {
        clearDirectory(filesystem, snapshot.root);
    } else {
        filesystem.mkdirTree(snapshot.root);
    }

    for (const {path} of snapshot.directories) filesystem.mkdirTree(path);
    for (const {path, content} of snapshot.files) {
        filesystem.writeFile(path, content);
        filesystem.utime(path, SNAPSHOT_MTIME_MS, SNAPSHOT_MTIME_MS);
    }
    for (const {path, mode} of snapshot.files) filesystem.chmod(path, mode);
    for (const {path, mode} of [...snapshot.directories].sort(byDepthDescending)) {
        filesystem.chmod(path, mode);
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

const byDepthDescending = (
    left: SandboxSnapshot["directories"][number],
    right: SandboxSnapshot["directories"][number]
): number => right.path.split("/").length - left.path.split("/").length;
