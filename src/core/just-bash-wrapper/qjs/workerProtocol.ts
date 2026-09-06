export interface QuickJsWorkerExecution {
    code: string;
    fileName: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
}

export type QuickJsExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};

export type QuickJsWorkerFetch = (url: string, options: Record<string, unknown>) => Promise<string>;

export interface QuickJsWorkerApi {
    ready(): Promise<void>;
    execute(
        execution: QuickJsWorkerExecution,
        fetch: QuickJsWorkerFetch
    ): Promise<QuickJsExecutionResult>;
}
