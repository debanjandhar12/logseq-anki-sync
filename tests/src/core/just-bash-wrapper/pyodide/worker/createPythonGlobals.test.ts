// @vitest-environment node
import {expect, test, vi} from "vitest";
import {createPythonGlobals} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createPythonGlobals";

test("exposes only the protected capability surface", async () => {
    const capabilities = createPythonGlobals();
    const {globals} = capabilities;
    expect(new globals.AbortController().signal.aborted).toBe(false);
    expect(new globals.Request("https://example.com").url).toBe("https://example.com/");
    expect(globals.Object.fromEntries([["key", "value"]])).toEqual({key: "value"});
    expect(() => globals.Request.constructor).toThrow("denied");
    expect(() => globals.Object.getPrototypeOf).toThrow("denied");
    const fetch = vi.fn(async () => new Response("ok"));
    capabilities.installFetch(fetch);
    expect(await (await globals.fetch("https://example.com")).text()).toBe("ok");
    expect(() => globals.fetch.constructor).toThrow("denied");
    expect(globals).not.toHaveProperty("installFetch");
});
