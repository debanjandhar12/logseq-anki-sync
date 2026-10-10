/// <reference lib="webworker" />

import {expose} from "comlink";
import type {PythonWorkerApi} from "../types";
import {executePythonInWorker} from "./executePythonInWorker";
import {initializePyodideWorker, type PyodideWorkerRuntime} from "./initializePyodideWorker";

let runtimePromise: Promise<PyodideWorkerRuntime> | undefined;

const workerApi: PythonWorkerApi = {
    async ready(runtimeBaseUrl) {
        runtimePromise ??= initializePyodideWorker(runtimeBaseUrl);
        await runtimePromise;
    },
    async execute(execution, fetch) {
        if (!runtimePromise) throw new Error("Pyodide is not initialized");
        return executePythonInWorker(await runtimePromise, execution, fetch);
    }
};

expose(workerApi);
