import {describe, expect, test} from "vitest";
import {LogseqHttpProxy} from "../../../src/logseq/LogseqHttpProxy";

type ProxyInternals = {
    getReturnType(request: Request): string;
    toResponse(result: unknown, returnType: "text" | "arraybuffer"): Response;
};

const proxy = LogseqHttpProxy as unknown as ProxyInternals;

describe("LogseqHttpProxy binary responses", () => {
    test("selects binary mode only for GET WASM requests", () => {
        expect(proxy.getReturnType(new Request("https://plugins.test/anydoc.wasm"))).toBe(
            "arraybuffer"
        );
        expect(proxy.getReturnType(new Request("https://plugins.test/api"))).toBe("text");
        expect(
            proxy.getReturnType(new Request("https://plugins.test/anydoc.wasm", {method: "POST"}))
        ).toBe("text");
    });

    test.each([
        new Uint8Array([0, 97, 115, 109]),
        [0, 97, 115, 109],
        {type: "Buffer", data: [0, 97, 115, 109]}
    ])("reconstructs binary host payloads", async (body) => {
        const response = proxy.toResponse({status: 200, ok: true, body}, "arraybuffer");

        expect(new Uint8Array(await response.arrayBuffer())).toEqual(
            new Uint8Array([0, 97, 115, 109])
        );
    });

    test("preserves text responses", async () => {
        const response = proxy.toResponse({status: 200, ok: true, body: {ok: true}}, "text");
        await expect(response.text()).resolves.toBe('{"ok":true}');
    });
});
