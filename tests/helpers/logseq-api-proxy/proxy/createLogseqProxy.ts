import {createNamespaceProxies} from "./createNamespaceProxies";
import {createLogseqProxySettings} from "./logseqProxySettings";

/** Installs the test facade without retaining the SDK's iframe transport. */
export function createLogseqProxy(config: {apiServer: string; apiToken: string}): void {
    globalThis.logseq = {
        ...createNamespaceProxies(config),
        ...createLogseqProxySettings()
    } as unknown as typeof logseq;
}
