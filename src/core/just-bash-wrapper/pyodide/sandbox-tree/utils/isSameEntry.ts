import type {SandboxEntry} from "../types";
import {bytesEqual} from "./bytesEqual";

/** Compare persistent entry state; mode-only changes are not written back. */
export function isSameEntry(
    left: SandboxEntry | undefined,
    right: SandboxEntry | undefined
): boolean {
    if (!left || !right) return left === right;
    if (left.kind === "file" && right.kind === "file")
        return bytesEqual(left.content, right.content);
    return left.kind === right.kind;
}
