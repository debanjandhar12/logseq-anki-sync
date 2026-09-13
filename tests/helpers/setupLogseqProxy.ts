import "@logseq/libs";
import proxyLogseq from "logseq-proxy";

interface LogseqProxyWrapperOptions {
    settings?: Record<string, unknown>;
    apiServer?: string;
    apiToken?: string;
}

export function setupLogseqProxy({
    settings = {},
    apiServer = process.env.LOGSEQ_API_SERVER || "http://127.0.0.1:12315",
    apiToken = process.env.LOGSEQ_API_TOKEN || ""
}: LogseqProxyWrapperOptions = {}): void {
    proxyLogseq({
        settings,
        config: {apiServer, apiToken}
    });

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
