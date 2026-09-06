/// <reference lib="webworker" />

import {executeQuickJsInWorker} from "./quickJsWorkerRuntime";
import type {QuickJsWorkerRequest, QuickJsWorkerResponse} from "./workerProtocol";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let nextFetchId = 0;
const pendingFetches = new Map<
    number,
    {resolve: (value: string) => void; reject: (error: Error) => void}
>();

worker.onmessage = ({data}: MessageEvent<QuickJsWorkerRequest>) => {
    if (data.type === "fetch-result") {
        const pending = pendingFetches.get(data.id);
        if (!pending) return;
        pendingFetches.delete(data.id);
        pending.resolve(
            JSON.stringify({...data.result, body: new TextDecoder().decode(data.result.body)})
        );
        return;
    }
    if (data.type === "fetch-error") {
        const pending = pendingFetches.get(data.id);
        if (!pending) return;
        pendingFetches.delete(data.id);
        pending.reject(new Error(data.message));
        return;
    }
    if (data.type !== "execute") return;

    void executeQuickJsInWorker(data.execution, requestFetch).then(
        (result) => post({type: "result", result}),
        (error) => post({type: "error", message: getErrorMessage(error)})
    );
};

function requestFetch(url: string, options: Record<string, unknown>): Promise<string> {
    const id = nextFetchId++;
    return new Promise((resolve, reject) => {
        pendingFetches.set(id, {resolve, reject});
        post({type: "fetch", id, url, options});
    });
}

function post(message: QuickJsWorkerResponse): void {
    worker.postMessage(message);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
