import {Async, FileSystem, InMemoryStore, StoreFS, type InodeLike} from "@zenfs/core";
import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";
import type {JustBashMountPermission} from "../types";

const FILE_TYPE = 0o100000;
const DIRECTORY_TYPE = 0o40000;

function fileModeFor(permission: JustBashMountPermission): number {
    if (permission === "readexecute") return 0o100555;
    if (permission === "read") return 0o100444;
    return 0o100666;
}

function directoryModeFor(permission: JustBashMountPermission): number {
    return permission === "readwrite" ? 0o40777 : 0o40555;
}

function errnoError(code: string, operation: string, path: string): Error {
    return Object.assign(new Error(`${code}: ${operation} '${path}'`), {code, path});
}

/**
 * Read-only zenfs filesystem over one flat Logseq plugin storage group.
 *
 * The Logseq plugin storage only holds depth-one text files, so this backend
 * exposes a single root directory with files directly under "/". Mutations are
 * never routed here: copy-on-write layers intercept writes before they reach
 * the readable layer.
 */
class FlatLogseqStorageFs extends FileSystem {
    constructor(
        private readonly groupName: string,
        private readonly permission: JustBashMountPermission
    ) {
        super(0x4c531, "logseq-storage");
    }

    private storageName(path: string, operation: string): string | null {
        if (path === "/") return null;
        const name = path.slice(1);
        if (name.includes("/") || name === "") {
            throw errnoError("ENOTSUP", operation, path);
        }
        return name;
    }

    private async storedText(path: string, operation: string): Promise<string> {
        const name = this.storageName(path, operation);
        if (name === null) throw errnoError("EISDIR", operation, path);
        const content = await LogseqPluginStorageManager.getFileContent(this.groupName, name);
        if (content === undefined) throw errnoError("ENOENT", operation, path);
        return content;
    }

    async stat(path: string): Promise<InodeLike> {
        if (this.storageName(path, "stat") === null) {
            return {
                size: 0,
                mode: DIRECTORY_TYPE | directoryModeFor(this.permission),
                atimeMs: 0,
                mtimeMs: 0,
                ctimeMs: 0,
                birthtimeMs: 0,
                uid: 0,
                gid: 0,
                ino: 0,
                nlink: 1,
                rdev: 0
            };
        }
        const content = await this.storedText(path, "stat");
        return {
            size: content.length,
            mode: FILE_TYPE | fileModeFor(this.permission),
            atimeMs: 0,
            mtimeMs: 0,
            ctimeMs: 0,
            birthtimeMs: 0,
            uid: 0,
            gid: 0,
            ino: 0,
            nlink: 1,
            rdev: 0
        };
    }

    async readdir(path: string): Promise<string[]> {
        if (this.storageName(path, "scandir") !== null) {
            throw errnoError("ENOTDIR", "scandir", path);
        }
        return LogseqPluginStorageManager.getFiles(this.groupName);
    }

    async read(path: string, buffer: Uint8Array, offset: number, end: number): Promise<void> {
        const bytes = new TextEncoder().encode(await this.storedText(path, "read"));
        const slice = bytes.subarray(0, Math.min(end, bytes.byteLength));
        buffer.set(slice, offset);
    }

    async rename(oldPath: string, _newPath: string): Promise<void> {
        throw errnoError("ENOTSUP", "rename", oldPath);
    }

    async touch(path: string): Promise<void> {
        throw errnoError("ENOTSUP", "touch", path);
    }

    async createFile(path: string): Promise<InodeLike> {
        throw errnoError("ENOTSUP", "create", path);
    }

    async unlink(path: string): Promise<void> {
        throw errnoError("ENOTSUP", "unlink", path);
    }

    async rmdir(path: string): Promise<void> {
        throw errnoError("ENOTSUP", "rmdir", path);
    }

    async mkdir(path: string): Promise<InodeLike> {
        throw errnoError("ENOTSUP", "mkdir", path);
    }

    async link(target: string): Promise<void> {
        throw errnoError("ENOTSUP", "link", target);
    }

    async write(path: string): Promise<void> {
        throw errnoError("ENOTSUP", "write", path);
    }

    async sync(): Promise<void> {}

    renameSync(path: string): void {
        throw errnoError("ENOTSUP", "rename", path);
    }

    statSync(path: string): InodeLike {
        throw errnoError("ENOTSUP", "stat", path);
    }

    touchSync(path: string): void {
        throw errnoError("ENOTSUP", "touch", path);
    }

    createFileSync(path: string): InodeLike {
        throw errnoError("ENOTSUP", "create", path);
    }

    unlinkSync(path: string): void {
        throw errnoError("ENOTSUP", "unlink", path);
    }

    rmdirSync(path: string): void {
        throw errnoError("ENOTSUP", "rmdir", path);
    }

    mkdirSync(path: string): InodeLike {
        throw errnoError("ENOTSUP", "mkdir", path);
    }

    readdirSync(path: string): string[] {
        throw errnoError("ENOTSUP", "scandir", path);
    }

    linkSync(target: string): void {
        throw errnoError("ENOTSUP", "link", target);
    }

    readSync(path: string): void {
        throw errnoError("ENOTSUP", "read", path);
    }

    writeSync(path: string): void {
        throw errnoError("ENOTSUP", "write", path);
    }

    syncSync(): void {}
}

/** The storage backend wrapped with a synchronous in-memory cache. */
export type CachedLogseqStorageFs = InstanceType<ReturnType<typeof Async<typeof FlatLogseqStorageFs>>>;

/**
 * Create a ready-to-mount readable filesystem over a Logseq plugin storage
 * group. The Async mixin preloads the group into an in-memory cache so
 * copy-on-write sync reads work; async reads stay live against storage.
 */
export async function createLogseqStorageFs(
    groupName: string,
    permission: JustBashMountPermission
): Promise<CachedLogseqStorageFs> {
    const storageFs = new (Async(FlatLogseqStorageFs))(groupName, permission);
    storageFs._sync = new StoreFS(new InMemoryStore());
    await storageFs.ready();
    return storageFs;
}
