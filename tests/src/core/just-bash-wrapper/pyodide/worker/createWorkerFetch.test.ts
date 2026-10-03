// @vitest-environment node
import {describe, expect, test, vi} from "vitest";
import {createWorkerFetch} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createWorkerFetch";
import type {PythonWorkerFetch} from "../../../../../../src/core/just-bash-wrapper/pyodide/workerProtocol";

describe("worker fetch bridge", () => {
    test("only exact runtime assets bypass host fetch", async () => {
        const local = "https://plugin.test/pyodide/python_stdlib.zip";
        const original = vi.fn(async () => new Response("local"));
        const host = vi.fn<PythonWorkerFetch>(async (url) => ({
            status: 200,
            statusText: "OK",
            headers: {"x-test": "yes"},
            body: new Uint8Array([0, 255, 128]),
            url: `${url}/final`
        }));
        const fetch = createWorkerFetch(host, original, new Set([local]));
        expect(await (await fetch(local)).text()).toBe("local");
        const response = await fetch(`${local}?other`, {
            method: "POST",
            headers: {"x-request": "yes"},
            body: "café"
        });
        expect(host).toHaveBeenCalledWith(`${local}?other`, {
            method: "POST",
            headers: {"content-type": "text/plain;charset=UTF-8", "x-request": "yes"},
            body: "café"
        });
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 255, 128]));
        expect(response.url).toBe(`${local}?other/final`);
        expect(response.headers.get("x-test")).toBe("yes");
        expect(original).toHaveBeenCalledOnce();
    });

    test.each([204, 205, 304])("supports responses without bodies: %s", async (status) => {
        const host: PythonWorkerFetch = async (url) => ({
            status,
            statusText: "",
            headers: {},
            body: new Uint8Array(),
            url
        });
        const response = await createWorkerFetch(host, fetch, new Set())("https://example.com");
        expect(response.status).toBe(status);
        expect(response.body).toBeNull();
    });

    test("propagates host rejection", async () => {
        const host = vi.fn(async () => {
            throw new Error("denied");
        });
        await expect(
            createWorkerFetch(host, fetch, new Set())("https://denied.test")
        ).rejects.toThrow("denied");
    });
});
