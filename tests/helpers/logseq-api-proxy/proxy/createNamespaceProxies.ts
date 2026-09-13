import {callLogseqApi} from "../api";

export function createNamespaceProxies(config: {apiServer: string; apiToken: string}) {
    return Object.fromEntries(
        (["App", "Editor", "DB", "Git", "UI", "Assets", "FileStorage"] as const).map(
            (namespace) => [
                namespace,
                new Proxy(
                    {},
                    {
                        get(_target, property) {
                            if (typeof property !== "string" || property === "then")
                                return undefined;
                            return (...args: unknown[]) =>
                                callLogseqApi({
                                    ...config,
                                    method: `logseq.${namespace}.${property}`,
                                    args
                                });
                        }
                    }
                )
            ]
        )
    );
}
