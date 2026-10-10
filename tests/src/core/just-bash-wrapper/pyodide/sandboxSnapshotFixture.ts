import type {
    SandboxEntry,
    SandboxSnapshot
} from "../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/types";

export function createSandboxSnapshot(
    root: string,
    entries: Record<string, SandboxEntry>
): SandboxSnapshot {
    return {root, entries: new Map(Object.entries(entries))};
}
