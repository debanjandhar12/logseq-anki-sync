import "@logseq/libs";
import {beforeEach} from "vitest";
import type {PluginSettings} from "../../../src/settings";
import {throttleLogseqRequests} from "./api";
import {createLogseqProxy} from "./proxy";
import {resetLogseqSettings, setDefaultSettings} from "./settings";

export interface LogseqApiProxyOptions {
    settings?: Partial<PluginSettings>;
    apiServer?: string;
    apiToken?: string;
}

export function setupLogseqProxy({
    settings = {},
    apiServer = process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
    apiToken = process.env.LOGSEQ_API_TOKEN || ""
}: LogseqApiProxyOptions = {}): void {
    setDefaultSettings(settings);
    throttleLogseqRequests(`${apiServer}/api`);
    beforeEach(() => resetLogseqSettings());

    createLogseqProxy({apiServer, apiToken});

    if (typeof logseq === "undefined") return;

    logseq.baseInfo ??= {id: "_rw1zys138"} as typeof logseq.baseInfo;
    logseq.showMainUI = () => undefined;
    logseq.hideMainUI = () => undefined;
    logseq.provideStyle = () => undefined;
    logseq.useSettingsSchema = () => undefined;
    logseq.beforeunload = () => undefined;
    logseq.ready = (cb) => Promise.resolve(cb?.());
    logseq.on = (() => logseq) as unknown as typeof logseq.on;
    logseq.App = new Proxy(logseq.App, {
        get(target, property, receiver) {
            if (
                property === "onThemeChanged" ||
                property === "onThemeModeChanged" ||
                property === "onCurrentGraphChanged" ||
                property === "onRouteChanged"
            ) {
                return () => () => undefined;
            }
            return Reflect.get(target, property, receiver);
        }
    });
    logseq.DB = new Proxy(logseq.DB, {
        get(target, property, receiver) {
            if (property === "onChanged") {
                return () => () => undefined;
            }
            return Reflect.get(target, property, receiver);
        }
    });
}
