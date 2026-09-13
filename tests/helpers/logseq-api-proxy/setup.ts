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

    logseq.baseInfo ??= {id: "browser-test"} as typeof logseq.baseInfo;
    logseq.showMainUI = () => undefined;
    logseq.hideMainUI = () => undefined;
    logseq.App = new Proxy(logseq.App, {
        get(target, property, receiver) {
            if (property === "onThemeChanged" || property === "onThemeModeChanged") {
                return () => () => undefined;
            }
            return Reflect.get(target, property, receiver);
        }
    });
}
