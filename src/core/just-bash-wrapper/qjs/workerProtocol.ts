import type {SecureFetch} from "just-bash";

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

export type QuickJsWorkerRequest =
    | {type: "execute"; execution: QuickJsWorkerExecution}
    | {type: "fetch-result"; id: number; result: Awaited<ReturnType<SecureFetch>>}
    | {type: "fetch-error"; id: number; message: string};

export type QuickJsWorkerResponse =
    | {type: "result"; result: QuickJsExecutionResult}
    | {type: "error"; message: string}
    | {
          type: "fetch";
          id: number;
          url: string;
          options: Omit<Parameters<SecureFetch>[1], "signal">;
      };
