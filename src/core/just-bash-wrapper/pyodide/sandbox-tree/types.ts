export type SandboxEntry =
    | {kind: "directory"; mode: number}
    | {kind: "file"; mode: number; content: Uint8Array};

/** Structured-cloneable tree of absolute paths, including the shared root. */
export interface SandboxSnapshot {
    root: string;
    entries: Map<string, SandboxEntry>;
}

export interface SandboxChanges {
    createdDirectories: string[];
    writtenFiles: Array<{path: string; content: Uint8Array}>;
    deletedFiles: string[];
    deletedDirectories: string[];
    unsupported: Array<{path: string; reason: string}>;
}
