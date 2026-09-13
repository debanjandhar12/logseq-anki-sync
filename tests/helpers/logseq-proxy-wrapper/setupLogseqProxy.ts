import "@logseq/libs";
import {beforeEach} from "vitest";
import type {PluginSettings} from "../../../src/settings";
import {createLogseqProxy} from "./createLogseqProxy";
import {resetLogseqSettings, setDefaultSettings} from "./logseqProxySettings";
import {throttleLogseqRequests} from "./throttleLogseqRequests";

export interface LogseqProxyWrapperOptions {
    settings?: Partial<PluginSettings>;
    apiServer?: string;
    apiToken?: string;
}

export function setupLogseqProxy({
    settings = {},
    apiServer = process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
    apiToken = process.env.LOGSEQ_API_TOKEN || ""
}: LogseqProxyWrapperOptions = {}): void {
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
