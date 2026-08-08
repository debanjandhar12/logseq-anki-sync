import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from "just-bash";
import {ToolResultStore} from "src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";
import {JUST_BASH_USER_HOME, type JustBashMountPermission} from "./types";
import {encodeStoredText, type FileEncodingOptions, toStorableText} from "./utils/fsContent";
import {
    eexistError,
    einvalError,
    eisdirError,
    enoentError,
    enotdirError,
    enotsupError,
    erofsError
} from "./utils/fsErrors";
import {resolveSandboxPath, toStorageFileName} from "./utils/fsPaths";

type DirentEntry = {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
};

/** A flat just-bash filesystem backed by one Logseq plugin storage group. */
export class JustBashAdapterFS implements IFileSystem {
    private static readonly mountRegistry = new Map<string, JustBashMountPermission>();

    private cachedFileNames = new Set<string>();

    constructor(
        private readonly groupName: string,
        private readonly permission: JustBashMountPermission
    ) {}

    /** Register a plugin storage folder at /home/user/<folderName>. */
    static addLogseqPluginFolder(folderName: string, permission: JustBashMountPermission): void {
        if (!folderName || folderName.includes("/") || folderName === "." || folderName === "..") {
            throw new Error(
                `Invalid Logseq plugin folder name for just-bash mount: "${folderName}"`
            );
        }
        JustBashAdapterFS.mountRegistry.set(folderName, permission);
    }

    static getMountConfigs(): Array<{mountPoint: string; filesystem: JustBashAdapterFS}> {
        return [...JustBashAdapterFS.mountRegistry.entries()].map(([folderName, permission]) => ({
            mountPoint: `${JUST_BASH_USER_HOME}/${folderName}`,
            filesystem: new JustBashAdapterFS(folderName, permission)
        }));
    }

    private assertWritable(operation: string, path: string): void {
        if (this.permission === "read") throw erofsError(operation, path);
    }

    private dirStat(): FsStat {
        return {
            isFile: false,
            isDirectory: true,
            isSymbolicLink: false,
            mode: this.permission === "read" ? 0o40555 : 0o40777,
            size: 0,
            mtime: new Date(0)
        };
    }

    private fileStat(content: string): FsStat {
        return {
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false,
            mode: this.permission === "read" ? 0o100444 : 0o100666,
            size: new TextEncoder().encode(content).length,
            mtime: new Date(0)
        };
    }

    private async readStoredText(path: string, operation: string): Promise<string> {
        const fileName = toStorageFileName(resolveSandboxPath("/", path));
        if (fileName == null) throw eisdirError(operation, path);
        const content = await LogseqPluginStorageManager.getFileContent(this.groupName, fileName);
        if (content === undefined) throw enoentError(operation, path);
        return content;
    }

    private async storeText(path: string, content: string, operation: string): Promise<void> {
        const fileName = toStorageFileName(resolveSandboxPath("/", path));
        if (fileName == null) throw eisdirError(operation, path);
        await LogseqPluginStorageManager.saveFile(this.groupName, fileName, content);
        this.cachedFileNames.add(fileName);
    }

    async readFile(path: string, options?: FileEncodingOptions | BufferEncoding): Promise<string> {
        return encodeStoredText(await this.readStoredText(path, "open"), options);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        return new TextEncoder().encode(await this.readStoredText(path, "open"));
    }

    async writeFile(
        path: string,
        content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        this.assertWritable("open", path);
        await this.storeText(path, toStorableText(content), "open");
    }

    async appendFile(
        path: string,
        content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        this.assertWritable("append", path);
        const resolvedPath = resolveSandboxPath("/", path);
        const fileName = toStorageFileName(resolvedPath);
        if (fileName == null) throw eisdirError("append", path);
        const existing =
            (await LogseqPluginStorageManager.getFileContent(this.groupName, fileName)) ?? "";
        await this.storeText(resolvedPath, existing + toStorableText(content), "append");
    }

    async exists(path: string): Promise<boolean> {
        const fileName = toStorageFileName(resolveSandboxPath("/", path));
        return (
            fileName == null ||
            (await LogseqPluginStorageManager.fileExists(this.groupName, fileName))
        );
    }

    async stat(path: string): Promise<FsStat> {
        const resolvedPath = resolveSandboxPath("/", path);
        if (toStorageFileName(resolvedPath) == null) return this.dirStat();
        return this.fileStat(await this.readStoredText(resolvedPath, "stat"));
    }

    async lstat(path: string): Promise<FsStat> {
        return this.stat(path);
    }

    async realpath(path: string): Promise<string> {
        const resolvedPath = resolveSandboxPath("/", path);
        if (!(await this.exists(resolvedPath))) throw enoentError("realpath", path);
        return resolvedPath;
    }

    async readdir(path: string): Promise<string[]> {
        if (toStorageFileName(resolveSandboxPath("/", path)) != null) {
            throw enotdirError("scandir", path);
        }
        const fileNames = await LogseqPluginStorageManager.getFiles(this.groupName);
        this.cachedFileNames = new Set(fileNames);
        return fileNames;
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
        return (await this.readdir(path)).map((name) => ({
            name,
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false
        }));
    }

    resolvePath(base: string, path: string): string {
        return resolveSandboxPath(base, path);
    }

    getAllPaths(): string[] {
        return ["/", ...[...this.cachedFileNames].map((name) => `/${name}`)];
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        this.assertWritable("rm", path);
        const fileName = toStorageFileName(resolveSandboxPath("/", path));
        if (fileName == null) {
            if (!options?.recursive) throw eisdirError("rm", path);
            for (const name of await LogseqPluginStorageManager.getFiles(this.groupName)) {
                await LogseqPluginStorageManager.deleteFile(this.groupName, name);
            }
            this.cachedFileNames.clear();
            return;
        }
        if (!(await LogseqPluginStorageManager.fileExists(this.groupName, fileName))) {
            if (options?.force) return;
            throw enoentError("rm", path);
        }
        await LogseqPluginStorageManager.deleteFile(this.groupName, fileName);
        this.cachedFileNames.delete(fileName);
    }

    async cp(src: string, dest: string, _options?: CpOptions): Promise<void> {
        this.assertWritable("cp", dest);
        await this.storeText(dest, await this.readStoredText(src, "cp"), "cp");
    }

    async mv(src: string, dest: string): Promise<void> {
        this.assertWritable("mv", dest);
        const srcName = toStorageFileName(resolveSandboxPath("/", src));
        if (srcName == null) throw eisdirError("mv", src);
        await this.cp(src, dest);
        await LogseqPluginStorageManager.deleteFile(this.groupName, srcName);
        this.cachedFileNames.delete(srcName);
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        if (toStorageFileName(resolveSandboxPath("/", path)) == null) {
            if (options?.recursive) return;
            throw eexistError("mkdir", path);
        }
        this.assertWritable("mkdir", path);
        throw enotsupError(
            "mkdir (subdirectories are not supported in mounted Logseq plugin folders)",
            path
        );
    }

    async chmod(path: string, _mode: number): Promise<void> {
        this.assertWritable("chmod", path);
        if (!(await this.exists(path))) throw enoentError("chmod", path);
    }

    async utimes(path: string, _atime: Date, _mtime: Date): Promise<void> {
        this.assertWritable("utimes", path);
        if (!(await this.exists(path))) throw enoentError("utimes", path);
    }

    async symlink(_target: string, linkPath: string): Promise<void> {
        throw enotsupError("symlink", linkPath);
    }

    async link(_existingPath: string, newPath: string): Promise<void> {
        throw enotsupError("link", newPath);
    }

    async readlink(path: string): Promise<string> {
        throw einvalError("readlink", path);
    }
}

JustBashAdapterFS.addLogseqPluginFolder(ToolResultStore.groupName, "read");
