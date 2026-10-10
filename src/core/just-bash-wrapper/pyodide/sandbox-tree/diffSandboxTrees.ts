import type {SandboxChanges, SandboxSnapshot} from "./types";
import {compareByDepthAscending, compareByDepthDescending} from "./utils/compareByDepth";
import {isSameEntry} from "./utils/isSameEntry";

/** Pure content/type diff. Root and unsupported paths are never removed. */
export function diffSandboxTrees(
    base: SandboxSnapshot,
    next: SandboxSnapshot,
    skippedPaths: ReadonlySet<string> = new Set()
): Omit<SandboxChanges, "unsupported"> {
    const changes: Omit<SandboxChanges, "unsupported"> = {
        createdDirectories: [],
        writtenFiles: [],
        deletedFiles: [],
        deletedDirectories: []
    };
    for (const [path, entry] of next.entries) {
        if (skippedPaths.has(path)) continue;
        const original = base.entries.get(path);
        if (entry.kind === "directory") {
            if (path !== base.root && original?.kind !== "directory")
                changes.createdDirectories.push(path);
        } else if (!isSameEntry(original, entry)) {
            changes.writtenFiles.push({path, content: entry.content});
        }
    }
    for (const [path, entry] of base.entries) {
        if (
            path === base.root ||
            skippedPaths.has(path) ||
            next.entries.get(path)?.kind === entry.kind
        )
            continue;
        if (entry.kind === "file") changes.deletedFiles.push(path);
        else changes.deletedDirectories.push(path);
    }
    changes.createdDirectories.sort(compareByDepthAscending);
    changes.deletedFiles.sort();
    changes.deletedDirectories.sort(compareByDepthDescending);
    return changes;
}
