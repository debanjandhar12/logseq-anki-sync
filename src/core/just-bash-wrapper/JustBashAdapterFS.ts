import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from "just-bash";
import {AnyDocParseResultStore} from "src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {ToolResultStore} from "src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";
import {
    assertRelativeStoragePath,
    assertStorageFileTree
} from "src/logseq/LogseqPluginStorageManager/relativeStoragePath";
import type {JustBashMountPermission} from "./types";
import {encodeStoredText, type FileEncodingOptions, toStorableText} from "./utils/fsContent";
import {
    eexistError,
    einvalError,
    eisdirError,
    enoentError,
    enotdirError,
    enotemptyError,
    enotsupError,
    erofsError
} from "./utils/fsErrors";
import {getStorageMountPath, resolveSandboxPath, toStorageFileName} from "./utils/fsPaths";

type DirentEntry = {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
};

/** A nested text filesystem backed by one Logseq plugin storage group. */
export class JustBashAdapterFS implements IFileSystem {
    private static readonly mountRegistry = new Map<string, JustBashMountPermission>();

    private cachedFileNames = new Set<string>();
    private cachedDirectoryNames = new Set<string>([""]);
    private readonly ephemeralDirectories = new Set<string>();

    constructor(
        private readonly groupName: string,
        private readonly permission: JustBashMountPermission
    ) {
        assertRelativeStoragePath(groupName);
    }

    /** Register a plugin storage folder under the virtual environment's user directory. */
    static addLogseqPluginFolder(folderName: string, permission: JustBashMountPermission): void {
        try {
            assertRelativeStoragePath(folderName);
            if (folderName.includes("/")) throw new Error("Mount name must be one segment");
        } catch {
            throw new Error(
                `Invalid Logseq plugin folder name for just-bash mount: "${folderName}"`
            );
        }
        JustBashAdapterFS.mountRegistry.set(folderName, permission);
    }

    static getMountConfigs(): Array<{mountPoint: string; filesystem: JustBashAdapterFS}> {
        return [...JustBashAdapterFS.mountRegistry.entries()].map(([folderName, permission]) => ({
            mountPoint: getStorageMountPath(folderName),
            filesystem: new JustBashAdapterFS(folderName, permission)
        }));
    }

    /** Refresh synchronous glob state from persistent files; empty directories are session-only. */
    async refresh(): Promise<void> {
        const files = await LogseqPluginStorageManager.getFiles(this.groupName);
        assertStorageFileTree(files);
        const directories = new Set<string>(["", ...this.ephemeralDirectories]);
        for (const file of files) {
            for (const ancestor of this.ancestors(file)) directories.add(ancestor);
        }
        for (const file of files) {
            if (directories.has(file)) throw einvalError("file/directory collision", file);
        }
        this.cachedFileNames = new Set(files);
        this.cachedDirectoryNames = directories;
    }

    private storagePath(path: string): string {
        return toStorageFileName(resolveSandboxPath("/", path)) ?? "";
    }

    private ancestors(path: string): string[] {
        const segments = path.split("/");
        return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("/"));
    }

    private assertTraversable(path: string, operation: string): void {
        for (const ancestor of this.ancestors(path)) {
            if (this.cachedFileNames.has(ancestor)) throw enotdirError(operation, path);
        }
    }

    private hasFileAncestor(path: string): boolean {
        return this.ancestors(path).some((ancestor) => this.cachedFileNames.has(ancestor));
    }

    private assertDirectory(path: string, operation: string): void {
        this.assertTraversable(path, operation);
        if (this.cachedFileNames.has(path)) throw enotdirError(operation, path);
        if (!this.cachedDirectoryNames.has(path)) throw enoentError(operation, path);
    }

    private async assertFileDestination(path: string, operation: string): Promise<string> {
        const file = this.storagePath(path);
        await this.refresh();
        this.assertTraversable(file, operation);
        if (this.cachedDirectoryNames.has(file)) throw eisdirError(operation, path);
        this.assertDirectory(
            file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "",
            operation
        );
        return file;
    }

    private assertWritable(operation: string, path: string): void {
        if (this.permission !== "readwrite") throw erofsError(operation, path);
    }

    private dirStat(): FsStat {
        return {
            isFile: false,
            isDirectory: true,
            isSymbolicLink: false,
            mode: this.permission === "readwrite" ? 0o40777 : 0o40555,
            size: 0,
            mtime: new Date(0)
        };
    }

    private fileStat(content: string): FsStat {
        return {
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false,
            mode:
                this.permission === "readexecute"
                    ? 0o100555
                    : this.permission === "read"
                      ? 0o100444
                      : 0o100666,
            size: new TextEncoder().encode(content).length,
            mtime: new Date(0)
        };
    }

    private async readStoredText(path: string, operation: string): Promise<string> {
        const fileName = this.storagePath(path);
        await this.refresh();
        this.assertTraversable(fileName, operation);
        if (this.cachedDirectoryNames.has(fileName)) throw eisdirError(operation, path);
        const content = await LogseqPluginStorageManager.getFileContent(this.groupName, fileName);
        if (content === undefined) throw enoentError(operation, path);
        return content;
    }

    private async storeText(path: string, content: string, operation: string): Promise<void> {
        const fileName = await this.assertFileDestination(path, operation);
        await LogseqPluginStorageManager.saveFile(this.groupName, fileName, content);
        this.cachedFileNames.add(fileName);
        for (const ancestor of this.ancestors(fileName)) this.cachedDirectoryNames.add(ancestor);
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
        const fileName = await this.assertFileDestination(path, "append");
        const existing =
            (await LogseqPluginStorageManager.getFileContent(this.groupName, fileName)) ?? "";
        await this.storeText(path, existing + toStorableText(content), "append");
    }

    async exists(path: string): Promise<boolean> {
        const fileName = this.storagePath(path);
        await this.refresh();
        if (this.hasFileAncestor(fileName)) return false;
        return this.cachedDirectoryNames.has(fileName) || this.cachedFileNames.has(fileName);
    }

    async stat(path: string): Promise<FsStat> {
        const fileName = this.storagePath(path);
        await this.refresh();
        this.assertTraversable(fileName, "stat");
        if (this.cachedDirectoryNames.has(fileName)) return this.dirStat();
        return this.fileStat(await this.readStoredText(path, "stat"));
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
        const directory = this.storagePath(path);
        await this.refresh();
        this.assertDirectory(directory, "scandir");
        const prefix = directory ? `${directory}/` : "";
        const children = new Set<string>();
        for (const entry of [...this.cachedFileNames, ...this.cachedDirectoryNames]) {
            if (entry !== directory && entry.startsWith(prefix)) {
                children.add(entry.slice(prefix.length).split("/")[0]);
            }
        }
        return [...children].sort();
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
        const directory = this.storagePath(path);
        return (await this.readdir(path)).map((name) => ({
            name,
            isFile: this.cachedFileNames.has(directory ? `${directory}/${name}` : name),
            isDirectory: this.cachedDirectoryNames.has(directory ? `${directory}/${name}` : name),
            isSymbolicLink: false
        }));
    }

    resolvePath(base: string, path: string): string {
        return resolveSandboxPath(base, path);
    }

    getAllPaths(): string[] {
        return [...new Set([...this.cachedDirectoryNames, ...this.cachedFileNames])]
            .sort()
            .map((name) => `/${name}`);
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        this.assertWritable("rm", path);
        const fileName = this.storagePath(path);
        await this.refresh();
        this.assertTraversable(fileName, "rm");
        if (!fileName && !options?.recursive) throw eisdirError("rm", path);
        const directory = this.cachedDirectoryNames.has(fileName);
        if (!directory && !this.cachedFileNames.has(fileName)) {
            if (options?.force) return;
            throw enoentError("rm", path);
        }
        const prefix = fileName ? `${fileName}/` : "";
        const descendants = [...this.cachedFileNames, ...this.cachedDirectoryNames].filter(
            (entry) => entry !== fileName && entry.startsWith(prefix)
        );
        if (directory && descendants.length && !options?.recursive)
            throw enotemptyError("rm", path);
        // Preserve remaining directory entries for this adapter's lifetime.
        for (const name of this.cachedDirectoryNames) this.ephemeralDirectories.add(name);
        for (const name of [...this.cachedFileNames]) {
            if (name === fileName || (directory && name.startsWith(prefix))) {
                await LogseqPluginStorageManager.deleteFile(this.groupName, name);
                this.cachedFileNames.delete(name);
            }
        }
        if (directory) {
            for (const name of [...this.ephemeralDirectories]) {
                if (name === fileName || name.startsWith(prefix))
                    this.ephemeralDirectories.delete(name);
            }
        }
        await this.refresh();
    }

    async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
        this.assertWritable("cp", dest);
        const source = this.storagePath(src);
        const destination = this.storagePath(dest);
        await this.refresh();
        this.assertTraversable(source, "cp");
        if (!this.cachedDirectoryNames.has(source)) {
            if (source === destination) throw einvalError("cp", dest);
            await this.storeText(dest, await this.readStoredText(src, "cp"), "cp");
            return;
        }
        if (!options?.recursive) throw eisdirError("cp", src);
        if (source === destination || !source || destination.startsWith(`${source}/`))
            throw einvalError("cp", dest);
        const prefix = `${source}/`;
        const files = [...this.cachedFileNames].filter((name) => name.startsWith(prefix));
        const directories = [...this.cachedDirectoryNames].filter((name) =>
            name.startsWith(prefix)
        );
        const contents = await Promise.all(
            files.map(async (name) => [name, await this.readStoredText(`/${name}`, "cp")] as const)
        );
        this.assertDirectory(
            destination.includes("/") ? destination.slice(0, destination.lastIndexOf("/")) : "",
            "cp"
        );
        await this.mkdir(dest, {recursive: true});
        for (const directory of directories)
            await this.mkdir(`/${destination}/${directory.slice(prefix.length)}`, {
                recursive: true
            });
        for (const [name, content] of contents)
            await this.storeText(`/${destination}/${name.slice(prefix.length)}`, content, "cp");
    }

    async mv(src: string, dest: string): Promise<void> {
        this.assertWritable("mv", dest);
        const source = this.storagePath(src);
        const destination = this.storagePath(dest);
        if (source === destination) {
            if (!(await this.exists(src))) throw enoentError("mv", src);
            return;
        }
        if (!source || source.startsWith(`${destination}/`) || !destination)
            throw einvalError("mv", dest);
        await this.refresh();
        const isDirectory = this.cachedDirectoryNames.has(source);
        if (
            isDirectory &&
            this.cachedDirectoryNames.has(destination) &&
            (await this.readdir(dest)).length
        )
            throw enotemptyError("mv", dest);
        await this.cp(src, dest, {recursive: true});
        await this.rm(src, {recursive: true});
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        this.assertWritable("mkdir", path);
        const directory = this.storagePath(path);
        await this.refresh();
        this.assertTraversable(directory, "mkdir");
        if (this.cachedFileNames.has(directory)) throw eexistError("mkdir", path);
        if (this.cachedDirectoryNames.has(directory)) {
            if (options?.recursive) return;
            throw eexistError("mkdir", path);
        }
        const ancestors = this.ancestors(directory);
        if (!options?.recursive) this.assertDirectory(ancestors.at(-1) ?? "", "mkdir");
        for (const name of [...ancestors, directory]) {
            this.ephemeralDirectories.add(name);
            this.cachedDirectoryNames.add(name);
        }
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
JustBashAdapterFS.addLogseqPluginFolder(AnyDocParseResultStore.groupName, "read");
JustBashAdapterFS.addLogseqPluginFolder(SkillStore.groupName, "read");
