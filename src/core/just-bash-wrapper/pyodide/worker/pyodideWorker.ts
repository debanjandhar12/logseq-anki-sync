/// <reference lib="webworker" />

import {expose} from "comlink";
import type {PythonWorkerApi} from "../workerProtocol";
import {executePythonInWorker} from "./executePythonInWorker";
import {initializePyodideWorker, type PyodideWorkerRuntime} from "./initializePyodideWorker";

let runtime: Promise<PyodideWorkerRuntime> | undefined;

const api: PythonWorkerApi = {
    async ready(runtimeBaseUrl) {
        runtime ??= initializePyodideWorker(runtimeBaseUrl);
        await runtime;
    },
    async execute(execution, fetch) {
        if (!runtime) throw new Error("Pyodide is not initialized");
        return executePythonInWorker(await runtime, execution, fetch);
    }
};

expose(api);
