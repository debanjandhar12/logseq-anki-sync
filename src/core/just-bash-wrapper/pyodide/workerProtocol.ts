export interface PythonWorkerExecution {
    code: string;
    fileName: string;
    args: string[];
    stdin: string;
    cwd: string;
    env: Record<string, string>;
}

export type PythonExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
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
