/// <reference lib="webworker" />

import {expose} from "comlink";
import {executeQuickJsInWorker, initializeQuickJsWorker} from "./quickJsWorkerRuntime";
import type {QuickJsWorkerApi} from "./workerProtocol";

const api: QuickJsWorkerApi = {
    ready: initializeQuickJsWorker,
    execute: executeQuickJsInWorker
};

expose(api);
