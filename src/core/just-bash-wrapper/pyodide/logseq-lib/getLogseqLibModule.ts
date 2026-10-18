import type {LogseqLibBridge} from "./types";

export function getLogseqLibModule(bridge: LogseqLibBridge) {
    const module = Object.create(null) as Record<string, (args: unknown) => Promise<string>>;
    for (const method of bridge.methods) {
        const call = async (args: unknown) => {
            // Pyodide's built-in conversion handles nested Python dictionaries.
            const input = args as {
                toJs?: (options: {dict_converter: typeof Object.fromEntries}) => unknown;
            };
            const converted = input?.toJs ? input.toJs({dict_converter: Object.fromEntries}) : args;
            const result = await bridge.call(method, converted as Record<string, unknown>);
            return JSON.stringify(result ?? null);
        };
        module[method] = new Proxy(call, {
            get: (_target, property) => {
                if (property === "name") return method;
                throw new Error(`Access to logseq_lib.${method}.${String(property)} is denied`);
            }
        });
    }
    return module;
}
