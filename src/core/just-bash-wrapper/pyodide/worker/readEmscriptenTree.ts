import type {SandboxChanges, SandboxEntry, SandboxSnapshot} from "../sandbox-tree/types";
import {joinSandboxPath} from "../sandbox-tree/utils/joinSandboxPath";
import type {PyodideFS} from "./pyodideFs";

/** Read MEMFS without following links or accepting special filesystem entries. */
export function readEmscriptenTree(
    filesystem: PyodideFS,
    root: string,
    onFile?: (path: string, entry: Extract<SandboxEntry, {kind: "file"}>) => void
): {
    tree: SandboxSnapshot;
    unsupported: SandboxChanges["unsupported"];
} {
    const entries = new Map<string, SandboxEntry>();
    const unsupported: SandboxChanges["unsupported"] = [];
    const visit = (path: string): void => {
        const {mode} = filesystem.lstat(path);
        if (filesystem.isLink(mode)) {
            unsupported.push({path, reason: "symbolic links are not supported"});
        } else if (filesystem.isDir(mode)) {
            entries.set(path, {kind: "directory", mode: mode & 0o777});
            for (const name of filesystem.readdir(path).sort()) {
                if (name !== "." && name !== "..") visit(joinSandboxPath(path, name));
            }
        } else if (filesystem.isFile(mode)) {
            const entry = {
                kind: "file",
                mode: mode & 0o777,
                content: filesystem.readFile(path)
            } as const;
            // Validate each file before retaining it or reading the next entry.
            onFile?.(path, entry);
            entries.set(path, entry);
        } else {
            unsupported.push({path, reason: "unsupported filesystem entry"});
        }
    };
    visit(root);
    return {tree: {root, entries}, unsupported};
}
