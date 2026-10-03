import path from "path-browserify";
import {assertRelativeStoragePath} from "../../../logseq/LogseqPluginStorageManager/relativeStoragePath";

/** Resolve a sandbox path against a base using normalized POSIX semantics. */
export function resolveSandboxPath(base: string, targetPath: string): string {
    return path.normalize(path.resolve(base, targetPath));
}

/** Map a normalized mount-relative path to a nested storage key. */
export function toStorageFileName(resolvedPath: string): string | null {
    if (resolvedPath === "/") return null;

    const fileName = resolvedPath.slice(1);
    assertRelativeStoragePath(fileName);
    return fileName;
}
