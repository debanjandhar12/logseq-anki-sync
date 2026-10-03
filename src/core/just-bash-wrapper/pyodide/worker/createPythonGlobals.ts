/** Restrict the JavaScript capabilities exposed through Python's `js` module. */
export function createPythonGlobals() {
    const globals = {
        AbortController: protectConstructor(globalThis.AbortController),
        AbortSignal: protectConstructor(globalThis.AbortSignal),
        Object: protectConstructor(globalThis.Object, {
            fromEntries: protectCallable(globalThis.Object.fromEntries)
        }),
        Request: protectConstructor(globalThis.Request),
        fetch: undefined as typeof globalThis.fetch | undefined
    };
    return {
        globals,
        installFetch(fetch: typeof globalThis.fetch) {
            globals.fetch = protectCallable(fetch);
        }
    };
}

function protectCallable<T extends (...args: never[]) => unknown>(callback: T): T {
    return new Proxy(callback, {
        get: (_target, property) => {
            if (property === "name") return "securedCapability";
            throw new Error(`Access to fetch.${String(property)} is denied`);
        },
        apply: (target, thisArg, args) => Reflect.apply(target, thisArg, args)
    });
}

function protectConstructor<T extends abstract new (...args: never[]) => unknown>(
    constructorFn: T,
    allowedProperties: Record<PropertyKey, unknown> = {}
): T {
    return new Proxy(constructorFn, {
        get: (_target, property) => {
            if (property === "name") return "securedCapability";
            if (Object.hasOwn(allowedProperties, property)) return allowedProperties[property];
            throw new Error(`Access to ${constructorFn.name}.${String(property)} is denied`);
        },
        construct: (target, args) => Reflect.construct(target, args)
    });
}
