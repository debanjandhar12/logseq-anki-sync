import type {fs as ZenFs} from "@zenfs/core";

/**
 * Exposes a synchronous zenfs filesystem to Emscripten's FS.mount, following
 * the documented custom-filesystem contract (node_ops + stream_ops, as used by
 * Emscripten's own NodeFS). Only what the Python sandbox needs is implemented:
 * plain files and directories — no symlinks, no special devices.
 */

interface EmscriptenFsModule {
    FSNode: new (
        parent: EmscriptenNode | null,
        name: string,
        mode: number,
        rdev: number
    ) => EmscriptenNode;
    hashAddNode(node: EmscriptenNode): void;
    isDir(mode: number): boolean;
    isFile(mode: number): boolean;
    ErrnoError: new (errno: number) => Error;
    ERRNO_CODES: Record<string, number>;
}

interface EmscriptenNode {
    name: string;
    parent: EmscriptenNode;
    mount: {opts: {root: string}};
    mode: number;
    node_ops: Record<string, unknown>;
    stream_ops: Record<string, unknown>;
}

interface EmscriptenMount {
    opts: {root: string};
}

function toErrno(module: EmscriptenFsModule, code: string, fallback: number): number {
    return module.ERRNO_CODES[code] ?? fallback;
}

function asErrnoError(
    module: EmscriptenFsModule,
    error: unknown,
    fallback = module.ERRNO_CODES.EIO ?? 5
): Error {
    const code = (error as {code?: string})?.code;
    if (typeof code === "string") {
        return new module.ErrnoError(toErrno(module, code, fallback));
    }
    return new module.ErrnoError(fallback);
}

export class ZenFsEmscriptenBridge {
    private readonly nodeOps: Record<string, unknown>;
    private readonly streamOps: Record<string, unknown>;

    constructor(
        private readonly zenfs: typeof ZenFs,
        private readonly emFs: EmscriptenFsModule
    ) {
        this.nodeOps = {
            getattr: (node: EmscriptenNode) => {
                try {
                    const stats = this.zenfs.statSync(this.realPath(node));
                    return {
                        mode: stats.mode,
                        size: Number(stats.size),
                        timestamp: Number(stats.mtimeMs)
                    };
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            setattr: (node: EmscriptenNode, attr: {size?: number}) => {
                const path = this.realPath(node);
                try {
                    if (attr.size !== undefined) {
                        const content = this.zenfs.readFileSync(path);
                        const next = new Uint8Array(Math.max(0, attr.size));
                        next.set(content.subarray(0, attr.size));
                        this.zenfs.writeFileSync(path, next);
                    }
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            lookup: (parent: EmscriptenNode, name: string) => {
                const path = this.join(this.realPath(parent), name);
                return this.createNode(parent, name, this.modeOf(path));
            },
            mknod: (parent: EmscriptenNode, name: string, mode: number) => {
                const path = this.join(this.realPath(parent), name);
                try {
                    if (this.emFs.isDir(mode)) {
                        this.zenfs.mkdirSync(path, mode);
                    } else {
                        this.zenfs.writeFileSync(path, "", {mode});
                    }
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
                return this.createNode(parent, name, mode);
            },
            rename: (node: EmscriptenNode, newParent: EmscriptenNode, newName: string) => {
                const newPath = this.join(this.realPath(newParent), newName);
                try {
                    this.zenfs.renameSync(this.realPath(node), newPath);
                    node.name = newName;
                    node.parent = newParent;
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            unlink: (parent: EmscriptenNode, name: string) => {
                try {
                    this.zenfs.unlinkSync(this.join(this.realPath(parent), name));
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            rmdir: (parent: EmscriptenNode, name: string) => {
                try {
                    this.zenfs.rmdirSync(this.join(this.realPath(parent), name));
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            readdir: (node: EmscriptenNode) => {
                try {
                    const contents = this.zenfs.readdirSync(this.realPath(node)) as string[];
                    return [...contents, ".", ".."];
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            symlink: () => {
                throw new this.emFs.ErrnoError(this.emFs.ERRNO_CODES.EPERM ?? 1);
            },
            readlink: () => {
                throw new this.emFs.ErrnoError(this.emFs.ERRNO_CODES.EINVAL ?? 22);
            }
        };

        this.streamOps = {
            open: (stream: {object: EmscriptenNode; position: number; flags: unknown}) => {
                if (!this.emFs.isFile(stream.object.mode)) return;
                stream.position = 0;
            },
            close: () => {},
            read: (
                stream: {object: EmscriptenNode; position: number},
                buffer: Uint8Array,
                offset: number,
                length: number
            ) => {
                try {
                    const content = this.zenfs.readFileSync(this.realPath(stream.object));
                    const chunk = content.subarray(
                        stream.position,
                        stream.position + length
                    );
                    buffer.set(chunk, offset);
                    stream.position += chunk.byteLength;
                    return chunk.byteLength;
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            write: (
                stream: {object: EmscriptenNode; position: number},
                buffer: Uint8Array,
                offset: number,
                length: number
            ) => {
                const path = this.realPath(stream.object);
                try {
                    const existing = this.zenfs.readFileSync(path);
                    const next = new Uint8Array(
                        Math.max(
                            existing.byteLength,
                            stream.position + length
                        )
                    );
                    next.set(existing);
                    next.set(buffer.subarray(offset, offset + length), stream.position);
                    this.zenfs.writeFileSync(path, next);
                    stream.position += length;
                    return length;
                } catch (error) {
                    throw asErrnoError(this.emFs, error);
                }
            },
            llseek: (
                stream: {object: EmscriptenNode; position: number},
                offset: number,
                whence: number
            ) => {
                let position = offset;
                if (whence === 1) position += stream.position;
                if (whence === 2 && this.emFs.isFile(stream.object.mode)) {
                    position += Number(this.zenfs.statSync(this.realPath(stream.object)).size);
                }
                if (position < 0) {
                    throw new this.emFs.ErrnoError(this.emFs.ERRNO_CODES.EINVAL ?? 22);
                }
                stream.position = position;
                return position;
            }
        };
    }

    /** Entry point invoked by `FS.mount(bridge, {root}, mountPoint)`. */
    mount(mount: EmscriptenMount): EmscriptenNode {
        return this.createNode(null, "/", this.modeOf(mount.opts.root));
    }

    private modeOf(path: string): number {
        try {
            return this.zenfs.statSync(path).mode;
        } catch (error) {
            throw asErrnoError(this.emFs, error, this.emFs.ERRNO_CODES.ENOENT ?? 44);
        }
    }

    private createNode(
        parent: EmscriptenNode | null,
        name: string,
        mode: number
    ): EmscriptenNode {
        const node = new this.emFs.FSNode(parent, name, mode, 0);
        node.node_ops = this.nodeOps;
        node.stream_ops = this.streamOps;
        this.emFs.hashAddNode(node);
        return node;
    }

    private realPath(node: EmscriptenNode): string {
        const parts: string[] = [];
        let current = node;
        while (current.parent !== current) {
            parts.push(current.name);
            current = current.parent;
        }
        parts.push(current.mount.opts.root);
        return parts.reverse().join("/");
    }

    private join(directory: string, name: string): string {
        return `${directory}/${name}`;
    }
}
