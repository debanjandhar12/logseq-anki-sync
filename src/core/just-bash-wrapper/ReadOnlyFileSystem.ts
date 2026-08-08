import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from "just-bash";
import type {FileEncodingOptions} from "./utils/fsContent";
import {erofsError} from "./utils/fsErrors";

/** Prevents every filesystem mutation while preserving read access. */
export class ReadOnlyFileSystem implements IFileSystem {
    constructor(private readonly filesystem: IFileSystem) {}

    readFile(path: string, options?: FileEncodingOptions | BufferEncoding): Promise<string> {
        return this.filesystem.readFile(path, options);
    }

    readFileBuffer(path: string): Promise<Uint8Array> {
        return this.filesystem.readFileBuffer(path);
    }

    writeFile(
        path: string,
        _content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        return Promise.reject(erofsError("open", path));
    }

    appendFile(
        path: string,
        _content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        return Promise.reject(erofsError("append", path));
    }

    exists(path: string): Promise<boolean> {
        return this.filesystem.exists(path);
    }

    stat(path: string): Promise<FsStat> {
        return this.filesystem.stat(path);
    }

    lstat(path: string): Promise<FsStat> {
        return this.filesystem.lstat(path);
    }

    realpath(path: string): Promise<string> {
        return this.filesystem.realpath(path);
    }

    readdir(path: string): Promise<string[]> {
        return this.filesystem.readdir(path);
    }

    resolvePath(base: string, path: string): string {
        return this.filesystem.resolvePath(base, path);
    }

    getAllPaths(): string[] {
        return this.filesystem.getAllPaths();
    }

    mkdir(path: string, _options?: MkdirOptions): Promise<void> {
        return Promise.reject(erofsError("mkdir", path));
    }

    rm(path: string, _options?: RmOptions): Promise<void> {
        return Promise.reject(erofsError("rm", path));
    }

    cp(_src: string, dest: string, _options?: CpOptions): Promise<void> {
        return Promise.reject(erofsError("cp", dest));
    }

    mv(_src: string, dest: string): Promise<void> {
        return Promise.reject(erofsError("mv", dest));
    }

    chmod(path: string, _mode: number): Promise<void> {
        return Promise.reject(erofsError("chmod", path));
    }

    utimes(path: string, _atime: Date, _mtime: Date): Promise<void> {
        return Promise.reject(erofsError("utimes", path));
    }

    symlink(_target: string, linkPath: string): Promise<void> {
        return Promise.reject(erofsError("symlink", linkPath));
    }

    link(_existingPath: string, newPath: string): Promise<void> {
        return Promise.reject(erofsError("link", newPath));
    }

    readlink(path: string): Promise<string> {
        return this.filesystem.readlink(path);
    }
}
