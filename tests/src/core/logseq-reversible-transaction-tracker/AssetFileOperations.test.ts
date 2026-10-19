import {afterEach, describe, expect, test, vi} from "vitest";
import {MAX_ASSET_DIFF_BYTES} from "../../../../src/constants";
import {AssetFileOperations} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/AssetFileOperations";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";

const resolved = {
    graphRoot: "/graph",
    fullPath: "/graph/assets/test",
    graphRelativePath: "assets/test",
    assetsRelativePath: "test"
};
afterEach(() => vi.restoreAllMocks());

function mockRead(size: number, chunks: Uint8Array[]) {
    vi.spyOn(AssetFileOperations, "getMetadata").mockResolvedValue({
        exists: true,
        byteLength: size
    });
    vi.spyOn(WindowParentBridge, "makeAssetUrl").mockResolvedValue("assets://graph/test");
    const cancel = vi.fn(async () => {});
    const body = new ReadableStream<Uint8Array>(
        {
            pull(controller) {
                if (chunks.length) controller.enqueue(chunks.shift()!);
                else controller.close();
            },
            cancel
        },
        {highWaterMark: 0}
    );
    const fetch = vi.fn(async () => ({ok: true, body}));
    vi.spyOn(WindowParentBridge, "getFetch").mockReturnValue(
        fetch as unknown as typeof globalThis.fetch
    );
    return {fetch, cancel};
}

describe("bounded asset previews", () => {
    test("captures the exact limit", async () => {
        mockRead(MAX_ASSET_DIFF_BYTES, [new Uint8Array(MAX_ASSET_DIFF_BYTES)]);
        const result = await AssetFileOperations.readForPreview(resolved);
        expect(result.exists && "bytes" in result && result.bytes.length).toBe(
            MAX_ASSET_DIFF_BYTES
        );
    });
    test("does not fetch assets already over the limit", async () => {
        const {fetch} = mockRead(MAX_ASSET_DIFF_BYTES + 1, []);
        await expect(AssetFileOperations.readForPreview(resolved)).resolves.toMatchObject({
            omitted: true,
            sizeIsExact: true
        });
        expect(fetch).not.toHaveBeenCalled();
    });
    test("enforces the actual stream limit when metadata understates size", async () => {
        const {cancel} = mockRead(1, [new Uint8Array(MAX_ASSET_DIFF_BYTES), new Uint8Array(1)]);
        await expect(AssetFileOperations.readForPreview(resolved)).resolves.toMatchObject({
            omitted: true,
            sizeIsExact: false
        });
        expect(cancel).toHaveBeenCalledOnce();
    });
    test("rejects inconsistent completed reads", async () => {
        mockRead(10, [new Uint8Array(2)]);
        await expect(AssetFileOperations.readForPreview(resolved)).rejects.toThrow("size changed");
    });
    test("missing files stay distinct from empty captures", async () => {
        mockRead(0, []);
        await expect(AssetFileOperations.readForPreview(resolved)).resolves.toMatchObject({
            exists: true,
            byteLength: 0
        });
        vi.spyOn(AssetFileOperations, "getMetadata").mockResolvedValue({exists: false});
        await expect(AssetFileOperations.readForPreview(resolved)).resolves.toEqual({
            exists: false
        });
    });
    test("rejects unresolved URLs", async () => {
        const {fetch} = mockRead(0, []);
        vi.spyOn(WindowParentBridge, "makeAssetUrl").mockResolvedValue("assets/test");
        await expect(AssetFileOperations.readForPreview(resolved)).rejects.toThrow(
            "resolve an asset URL"
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    test("does not swallow fetch failures", async () => {
        const {fetch} = mockRead(1, []);
        fetch.mockRejectedValue(new Error("permission denied"));
        await expect(AssetFileOperations.readForPreview(resolved)).rejects.toThrow(
            "permission denied"
        );
    });

    test("rejects malformed metadata", async () => {
        vi.spyOn(WindowParentBridge, "getWindow").mockReturnValue({
            apis: {doAction: vi.fn(async () => ({size: NaN}))}
        } as never);
        await expect(AssetFileOperations.getMetadata(resolved)).rejects.toThrow("metadata");
    });
});
