import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from "just-bash";
import {fs, type InodeLike} from "@zenfs/core";
import {JUST_BASH_USER_HOME} from "../types";
import {encodeStoredText, type FileEncodingOptions} from "../utils/fsContent";
import {erofsError} from "../utils/fsErrors";
import {resolveSandboxPath} from "../utils/fsPaths";

type DirentEntry = {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
};

const FILE_TYPE = 0o100000;
const DIRECTORY_TYPE = 0o40000;
const SYMLINK_TYPE = 0o120000;
const TYPE_MASK = 0o170000;

const WRITABLE_ROOTS = [JUST_BASH_USER_HOME, "/tmp"];

/** just-bash IFileSystem view over the shared zenfs session filesystem. */
export class ZenFsAdapter implements IFileSystem {
    async readFile(path: string, options?: FileEncodingOptions | BufferEncoding): Promise<string> {
        const bytes = await this.readFileBuffer(path);
        return encodeStoredText(new TextDecoder().decode(bytes), options);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        const content = await fs.promises.readFile(path);
        return new Uint8Array(content);
    }

    async writeFile(
        path: string,
        content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        assertWritable("open", path);
        await fs.promises.writeFile(path, content);
    }

    async appendFile(
        path: string,
        content: FileContent,
        _options?: FileEncodingOptions | BufferEncoding
    ): Promise<void> {
        assertWritable("append", path);
        await fs.promises.appendFile(path, content);
    }

    async exists(path: string): Promise<boolean> {
        try {
            await fs.promises.stat(path);
            return true;
        } catch {
            return false;
        }
    }

    async stat(path: string): Promise<FsStat> {
        return toFsStat(await fs.promises.stat(path));
    }

    async lstat(path: string): Promise<FsStat> {
        return toFsStat(await fs.promises.lstat(path));
    }

    async realpath(path: string): Promise<string> {
        return fs.promises.realpath(path) as Promise<string>;
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        assertWritable("mkdir", path);
        await fs.promises.mkdir(path, {recursive: options?.recursive === true});
    }

    async readdir(path: string): Promise<string[]> {
        const entries = await fs.promises.readdir(path);
        return (entries as string[]).filter((name) => name !== "." && name !== "..");
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
        return Promise.all(
            (await this.readdir(path)).map(async (name) => {
                const stats = await this.stat(joinPath(path, name));
                return {
                    name,
                    isFile: stats.isFile,
                    isDirectory: stats.isDirectory,
                    isSymbolicLink: stats.isSymbolicLink
                };
            })
        );
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        assertWritable("rm", path);
        let stats: InodeLike;
        try {
            stats = await fs.promises.stat(path);
        } catch (error) {
            if (options?.force) return;
            throw error;
        }
        if ((stats.mode & TYPE_MASK) === DIRECTORY_TYPE) {
            if (!options?.recursive && (await this.readdir(path)).length > 0) {
                throw new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`);
            }
            await fs.promises.rmdir(path);
            return;
        }
        await fs.promises.unlink(path);
    }

    async cp(src: string, dest: string, _options?: CpOptions): Promise<void> {
        assertWritable("cp", dest);
        const stats = await fs.promises.stat(src);
        if ((stats.mode & TYPE_MASK) === DIRECTORY_TYPE) {
            await this.cpDirectory(src, dest);
            return;
        }
        await fs.promises.writeFile(dest, await this.readFileBuffer(src));
    }

    private async cpDirectory(src: string, dest: string): Promise<void> {
        await fs.promises.mkdir(dest, {recursive: true});
        for (const name of await this.readdir(src)) {
            await this.cp(joinPath(src, name), joinPath(dest, name));
        }
    }

    async mv(src: string, dest: string): Promise<void> {
        assertWritable("mv", dest);
        try {
            await fs.promises.rename(src, dest);
        } catch {
            await this.cp(src, dest);
            await this.rm(src, {recursive: true, force: true});
        }
    }

    resolvePath(base: string, targetPath: string): string {
        return resolveSandboxPath(base, targetPath);
    }

    getAllPaths(): string[] {
        const paths: string[] = [];
        const stack = ["/"];
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
                const fullPath = joinPath(directory, name);
                paths.push(fullPath);
                try {
                    if ((fs.statSync(fullPath).mode & TYPE_MASK) === DIRECTORY_TYPE) {
                        stack.push(fullPath);
                    }
                } catch {
                    // dangling entries still surface in listings
                }
            }
        }
        return paths;
    }

    async chmod(path: string, mode: number): Promise<void> {
        assertWritable("chmod", path);
        await fs.promises.chmod(path, mode);
    }

    async symlink(target: string, linkPath: string): Promise<void> {
        assertWritable("symlink", linkPath);
        await fs.promises.symlink(target, linkPath);
    }

    async link(existingPath: string, newPath: string): Promise<void> {
        assertWritable("link", newPath);
        await fs.promises.link(existingPath, newPath);
    }

    async readlink(path: string): Promise<string> {
        return fs.promises.readlink(path) as Promise<string>;
    }

    async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
        assertWritable("utimes", path);
        await fs.promises.utimes(path, atime, mtime);
    }
}

function assertWritable(operation: string, path: string): void {
    const writable = WRITABLE_ROOTS.some(
        (root) => path === root || path.startsWith(`${root}/`)
    );
    if (!writable) throw erofsError(operation, path);
}

function toFsStat(stats: InodeLike): FsStat {
    const type = stats.mode & TYPE_MASK;
    return {
        isFile: type === FILE_TYPE,
        isDirectory: type === DIRECTORY_TYPE,
        isSymbolicLink: type === SYMLINK_TYPE,
        mode: stats.mode,
        size: Number(stats.size),
        mtime: new Date(Number(stats.mtimeMs))
    };
}

function joinPath(directory: string, name: string): string {
    return directory.endsWith("/") ? `${directory}${name}` : `${directory}/${name}`;
}
