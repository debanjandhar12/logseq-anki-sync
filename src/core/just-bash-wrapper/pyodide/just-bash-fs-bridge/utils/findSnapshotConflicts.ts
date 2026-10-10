import type {IFileSystem} from "just-bash";
import type {SandboxChanges, SandboxSnapshot} from "../../sandbox-tree/types";
import {isSameEntry} from "../../sandbox-tree/utils/isSameEntry";
import {listAncestorsWithinRoot} from "../../sandbox-tree/utils/listAncestorsWithinRoot";
import {listSnapshotChildren} from "../../sandbox-tree/utils/listSnapshotChildren";
import type {WriteBackFailure} from "../types";
import {readHostEntry} from "./readHostEntry";

export async function findSnapshotConflicts(
    filesystem: IFileSystem,
    changes: SandboxChanges,
    snapshot: SandboxSnapshot
): Promise<WriteBackFailure[]> {
    const deletedDirectories = new Set(changes.deletedDirectories);
    const directPaths = [
        ...changes.deletedFiles,
        ...deletedDirectories,
        ...changes.createdDirectories,
        ...changes.writtenFiles.map(({path}) => path)
    ];
    const affectedPaths = new Set(directPaths);
    for (const path of directPaths) {
        for (const ancestor of listAncestorsWithinRoot(path, snapshot.root))
            affectedPaths.add(ancestor);
    }
    const failures: WriteBackFailure[] = [];
    for (const path of affectedPaths) {
        try {
            const live = await readHostEntry(filesystem, path);
            const original = snapshot.entries.get(path);
            if (!isSameEntry(original, live)) {
                failures.push(conflict(path));
            } else if (original?.kind === "directory" && deletedDirectories.has(path)) {
                const names = (await filesystem.readdir(path)).sort();
                const expected = listSnapshotChildren(snapshot, path);
                if (
                    names.length !== expected.length ||
                    names.some((name, index) => name !== expected[index])
                ) {
                    failures.push(conflict(path));
                }
            }
        } catch (error) {
            failures.push({path, message: error instanceof Error ? error.message : String(error)});
        }
    }
    return failures;
}

function conflict(path: string): WriteBackFailure {
    return {path, message: "filesystem changed after the Python snapshot was captured"};
}
