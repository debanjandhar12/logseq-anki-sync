/// <reference lib="webworker" />

import {expose} from "comlink";
import {executePythonInWorker, initializePyodideWorker} from "./pyodideWorkerRuntime";
import type {PythonWorkerApi} from "./workerProtocol";

const api: PythonWorkerApi = {
    ready: initializePyodideWorker,
    execute: executePythonInWorker
};

expose(api);
