/** Error factories matching Node and just-bash filesystem message conventions. */
export const enoentError = (operation: string, path: string): Error =>
    new Error(`ENOENT: no such file or directory, ${operation} '${path}'`);

export const erofsError = (operation: string, path: string): Error =>
    new Error(`EROFS: read-only file system, ${operation} '${path}'`);

export const enotsupError = (operation: string, path: string): Error =>
    new Error(`ENOTSUP: operation not supported, ${operation} '${path}'`);

export const enotdirError = (operation: string, path: string): Error =>
    new Error(`ENOTDIR: not a directory, ${operation} '${path}'`);

export const eisdirError = (operation: string, path: string): Error =>
    new Error(`EISDIR: illegal operation on a directory, ${operation} '${path}'`);

export const eexistError = (operation: string, path: string): Error =>
    new Error(`EEXIST: file already exists, ${operation} '${path}'`);

export const einvalError = (operation: string, path: string): Error =>
    new Error(`EINVAL: invalid argument, ${operation} '${path}'`);
