import {Buffer} from "node:buffer";
import {TextDecoder, TextEncoder} from "node:util";
import {beforeAll, describe, expect, test} from "vitest";

const NodeUint8Array = Object.getPrototypeOf(Buffer.prototype).constructor;
Object.assign(globalThis, {Buffer, TextDecoder, TextEncoder, Uint8Array: NodeUint8Array});

let bundleJSStringPlugin: typeof import("../../vite-plugins/bundleJSStringPlugin").bundleJSStringPlugin;

beforeAll(async () => {
    ({bundleJSStringPlugin} = await import("../../vite-plugins/bundleJSStringPlugin"));
});

describe("bundleJSStringPlugin", () => {
    test("bundles TypeScript and replaces Vite environment values", async () => {
        const plugin = bundleJSStringPlugin("production");

        const result = await plugin.transform(
            'const value: number = 42; globalThis.result = value + ":" + import.meta.env.MODE + ":" + import.meta.env.PROD;',
            "/project/example.ts?string"
        );

        expect(result).toBeDefined();
        expect(result?.code).toMatch(/^export default /);
        const bundledSource = JSON.parse(
            result?.code.slice("export default ".length, -1) ?? '""'
        ) as string;
        expect(bundledSource).toContain("42:production:true");
        expect(bundledSource).not.toContain("import.meta.env");
    });

    test("ignores normal JavaScript modules", async () => {
        const plugin = bundleJSStringPlugin("test");

        await expect(
            plugin.transform("export const value = 42;", "/project/example.ts")
        ).resolves.toBeUndefined();
    });
});
