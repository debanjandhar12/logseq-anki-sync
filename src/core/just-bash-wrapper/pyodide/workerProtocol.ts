export interface PythonWorkerExecution {
    code: string;
    fileName: string;
    args: string[];
    stdin: string;
    cwd: string;
    env: Record<string, string>;
    files?: PythonSharedFile[];
}

/** A file snapshot entry or change crossing the host ↔ worker boundary. */
export interface PythonSharedFile {
    path: string;
    content?: Uint8Array;
    deleted?: boolean;
}

export type PythonExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    changedFiles?: PythonSharedFile[];
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
