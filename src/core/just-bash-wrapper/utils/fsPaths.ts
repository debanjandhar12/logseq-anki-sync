import path from "path-browserify";
import {enotsupError} from "./fsErrors";

/** Resolve a sandbox path against a base using normalized POSIX semantics. */
export function resolveSandboxPath(base: string, targetPath: string): string {
    return path.normalize(path.resolve(base, targetPath));
}

/** Map a mount-relative path to the flat Logseq plugin storage namespace. */
export function toStorageFileName(resolvedPath: string): string | null {
    if (resolvedPath === "/") return null;

    const fileName = resolvedPath.slice(1);
    if (fileName.includes("/")) throw enotsupError("access", resolvedPath);
    return fileName;
}
