export interface SandboxSnapshotDirectory {
    path: string;
    mode: number;
}

export interface SandboxSnapshotFile {
    path: string;
    mode: number;
    content: Uint8Array;
}

export interface SandboxSnapshot {
    root: string;
    directories: SandboxSnapshotDirectory[];
    files: SandboxSnapshotFile[];
}

export interface SandboxChanges {
    createdDirectories: string[];
    writtenFiles: Array<{path: string; content: Uint8Array}>;
    deletedFiles: string[];
    deletedDirectories: string[];
    unsupported: Array<{path: string; reason: string}>;
}

export interface PythonWorkerExecution {
    code: string;
    fileName: string;
    args: string[];
    stdin: string;
    cwd: string;
    env: Record<string, string>;
    snapshot: SandboxSnapshot;
}

export type PythonExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    changes?: SandboxChanges;
};

export type PythonWorkerFetchResponse = {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: Uint8Array;
    url: string;
};

export type PythonWorkerFetch = (
    url: string,
    options: {method?: string; headers?: Record<string, string>; body?: string}
) => Promise<PythonWorkerFetchResponse>;

export interface PythonWorkerApi {
    ready(runtimeBaseUrl: string): Promise<void>;
    execute(
        execution: PythonWorkerExecution,
        fetch: PythonWorkerFetch
    ): Promise<PythonExecutionResult>;
}
