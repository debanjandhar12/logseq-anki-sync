import {describe, expect, test, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    rebuild: vi.fn(),
    dispose: vi.fn()
}));

vi.mock("node:path", () => ({dirname: () => "/project"}));
vi.mock("esbuild", () => ({
    context: vi.fn(async () => ({rebuild: mocks.rebuild, dispose: mocks.dispose}))
}));

import {bundleJSStringPlugin} from "../../vite-plugins/bundleJSStringPlugin";

(globalThis as typeof globalThis & {__dirname: string}).__dirname = "/project";

describe("bundleJSStringPlugin", () => {
    test("bundles TypeScript and replaces Vite environment values", async () => {
        mocks.rebuild.mockResolvedValue({
            outputFiles: [{text: '(() => { const value = "42:production:true"; })();'}]
        });
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
        expect(mocks.dispose).toHaveBeenCalledOnce();
    });

    test("ignores normal JavaScript modules", async () => {
        const plugin = bundleJSStringPlugin("test");

        await expect(
            plugin.transform("export const value = 42;", "/project/example.ts")
        ).resolves.toBeUndefined();
        expect(mocks.rebuild).not.toHaveBeenCalled();
    });
});
