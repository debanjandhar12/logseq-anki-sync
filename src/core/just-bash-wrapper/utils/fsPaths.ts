import path from "path-browserify";
import {VIR_ENV_USER_PATH} from "../../../constants";
import {assertRelativeStoragePath} from "../../../logseq/LogseqPluginStorageManager/relativeStoragePath";

/** Produce an absolute virtual path using the same mapping as storage mounts. */
export function getStorageMountPath(groupName: string, relativePath?: string): string {
    assertRelativeStoragePath(groupName);
    if (relativePath !== undefined) assertRelativeStoragePath(relativePath);
    return `${VIR_ENV_USER_PATH}/${groupName}${relativePath === undefined ? "" : `/${relativePath}`}`;
}

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
