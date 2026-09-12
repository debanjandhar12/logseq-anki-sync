import {fs} from "@zenfs/core";
import {JUST_BASH_USER_HOME} from "../types";
import {SessionFileSystem} from "./sessionFs";

/** A file crossing the just-bash ↔ pyodide worker boundary. */
export interface SharedFileChange {
    path: string;
    content?: Uint8Array;
    deleted?: boolean;
}

export const SHARED_FILES_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const SHARED_FILES_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SHARED_FILES_MAX_COUNT = 2000;

interface SharedFilesBudget {
    totalBytes: number;
    count: number;
}

function chargeBudget(budget: SharedFilesBudget, path: string, byteLength: number): void {
    if (byteLength > SHARED_FILES_MAX_FILE_BYTES) {
        throw new Error(`Shared file '${path}' exceeded the ${SHARED_FILES_MAX_FILE_BYTES} byte limit`);
    }
    budget.totalBytes += byteLength;
    budget.count += 1;
    if (budget.totalBytes > SHARED_FILES_MAX_TOTAL_BYTES || budget.count > SHARED_FILES_MAX_COUNT) {
        throw new Error("Shared filesystem snapshot exceeded its size or file count limit");
    }
}

/** Collect every file under /home/user so pyodide can start from the same view. */
export async function snapshotSharedFiles(): Promise<SharedFileChange[]> {
    const snapshot: SharedFileChange[] = [];
    const budget: SharedFilesBudget = {totalBytes: 0, count: 0};
    await walkSharedFiles(JUST_BASH_USER_HOME, async (path, content) => {
        chargeBudget(budget, path, content.byteLength);
        snapshot.push({path, content});
    });
    return snapshot;
}

async function walkSharedFiles(
    root: string,
    visit: (path: string, content: Uint8Array) => Promise<void>
): Promise<void> {
    let names: string[];
    try {
        names = (await fs.promises.readdir(root)) as string[];
    } catch {
        return;
    }
    for (const name of names) {
        if (name === "." || name === "..") continue;
        const path = root.endsWith("/") ? `${root}${name}` : `${root}/${name}`;
        const stats = await fs.promises.stat(path);
        if ((stats.mode & 0o170000) === 0o40000) {
            await walkSharedFiles(path, visit);
            continue;
        }
        await visit(path, new Uint8Array(await fs.promises.readFile(path)));
    }
}

/** Synchronous walk used inside the pyodide worker, where everything is in memory. */
export function readSharedFilesSync(root: string): Array<{path: string; content: Uint8Array}> {
    const files: Array<{path: string; content: Uint8Array}> = [];
    const stack = [root];
    while (stack.length > 0) {
        const directory = stack.pop() as string;
        let names: string[];
        try {
            names = fs.readdirSync(directory) as string[];
        } catch {
            continue;
        }
        for (const name of names) {
            if (name === "." || name === "..") continue;
            const path = directory.endsWith("/") ? `${directory}${name}` : `${directory}/${name}`;
            try {
                if ((fs.statSync(path).mode & 0o170000) === 0o40000) {
                    stack.push(path);
                    continue;
                }
                files.push({path, content: new Uint8Array(fs.readFileSync(path))});
            } catch {
                // entries that vanish mid-walk are skipped
            }
        }
    }
    return files;
}

function contentEquals(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
    if (left === right) return true;
    if (!left || !right || left.byteLength !== right.byteLength) return false;
    for (let index = 0; index < left.byteLength; index += 1) {
        if (left[index] !== right[index]) return false;
    }
    return true;
}

/** Diff the worker filesystem against the snapshot it started from. */
export function diffSharedFiles(
    snapshot: readonly SharedFileChange[],
    current: readonly Array<{path: string; content: Uint8Array}>
): SharedFileChange[] {
    const before = new Map(snapshot.map((file) => [file.path, file.content]));
    const after = new Map(current.map((file) => [file.path, file.content]));
    const changes: SharedFileChange[] = [];
    for (const [path, content] of after) {
        if (!contentEquals(before.get(path), content)) changes.push({path, content});
    }
    for (const path of before.keys()) {
        if (!after.has(path)) changes.push({path, deleted: true});
    }
    return changes;
}

/**
 * Fold worker changes back into the session filesystem. Returns the paths
 * whose writes were discarded because their mount is read-only.
 */
export async function applySharedFileChanges(
    changes: readonly SharedFileChange[]
): Promise<string[]> {
    const discarded: string[] = [];
    const session = SessionFileSystem.getInstance();
    const readMounts = (session?.mounts ?? []).filter(
        (mount) => mount.permission !== "readwrite"
    );
    const budget: SharedFilesBudget = {totalBytes: 0, count: 0};

    for (const change of changes) {
        const readOnlyMount = readMounts.find(
            (mount) => change.path === mount.mountPoint || change.path.startsWith(`${mount.mountPoint}/`)
        );
        if (readOnlyMount) {
            discarded.push(change.path);
            continue;
        }
        try {
            chargeBudget(budget, change.path, change.content?.byteLength ?? 0);
            if (change.deleted) {
                await fs.promises.rm(change.path, {force: true});
            } else {
                await fs.promises.writeFile(change.path, change.content as Uint8Array);
            }
        } catch {
            discarded.push(change.path);
        }
    }
    return discarded;
}

/** Write a snapshot into a freshly configured worker filesystem. */
export async function prepareWorkerSharedFiles(
    files: readonly SharedFileChange[]
): Promise<void> {
    for (const file of files) {
        if (file.deleted) continue;
        const directory = file.path.slice(0, file.path.lastIndexOf("/"));
        if (directory) await fs.promises.mkdir(directory, {recursive: true});
        await fs.promises.writeFile(file.path, file.content as Uint8Array);
    }
}
