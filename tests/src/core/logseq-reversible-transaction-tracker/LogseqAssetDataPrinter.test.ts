import {Buffer} from "buffer";
import {afterEach, describe, expect, test, vi} from "vitest";
import {AssetFileOperations} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/AssetFileOperations";
import {
    LogseqAssetDataPrinter,
    type LogseqPrintedAssetSnapshot
} from "../../../../src/core/logseq-reversible-transaction-tracker/LogseqAssetDataPrinter";

afterEach(() => vi.restoreAllMocks());

function snapshot(content?: string): LogseqPrintedAssetSnapshot {
    return {
        assetPath: "assets/test",
        side:
            content === undefined
                ? {exists: false}
                : {
                      exists: true,
                      byteLength: content.length,
                      sizeIsExact: true,
                      preview: {kind: "text", content}
                  },
        comparisonBase64:
            content === undefined ? undefined : Buffer.from(content).toString("base64")
    };
}

describe("asset net changes", () => {
    test("filters exact no-ops and missing pairs, but distinguishes empty files", () => {
        expect(
            LogseqAssetDataPrinter.createChanges([snapshot("same")], [snapshot("same")])
        ).toEqual([]);
        expect(LogseqAssetDataPrinter.createChanges([snapshot()], [snapshot()])).toEqual([]);
        expect(LogseqAssetDataPrinter.createChanges([snapshot()], [snapshot("")])[0].status).toBe(
            "added"
        );
        expect(
            LogseqAssetDataPrinter.createChanges([snapshot("old")], [snapshot()])[0].status
        ).toBe("deleted");
    });
    test("keeps equal-size replacements and uncaptured content", () => {
        expect(
            LogseqAssetDataPrinter.createChanges([snapshot("one")], [snapshot("two")])
        ).toHaveLength(1);
        const unknown: LogseqPrintedAssetSnapshot = {
            assetPath: "assets/test",
            side: {
                exists: true,
                byteLength: 100,
                sizeIsExact: true,
                preview: {kind: "unavailable", reason: "too-large"}
            }
        };
        expect(LogseqAssetDataPrinter.createChanges([unknown], [unknown])[0].comparison).toBe(
            "unknown"
        );
    });
    test("preserves BOM-only and newline-only byte changes", () => {
        expect(
            LogseqAssetDataPrinter.createChanges([snapshot("a")], [snapshot("\ufeffa")])
        ).toHaveLength(1);
        expect(
            LogseqAssetDataPrinter.createChanges([snapshot("a\n")], [snapshot("a\r\n")])
        ).toHaveLength(1);
    });
    test("rejects mismatched and duplicate paths", () => {
        expect(() => LogseqAssetDataPrinter.createChanges([snapshot()], [])).toThrow("pair");
        expect(() =>
            LogseqAssetDataPrinter.createChanges([snapshot(), snapshot()], [snapshot(), snapshot()])
        ).toThrow("duplicate");
    });
});

describe("asset capture classification", () => {
    test.each([
        ["source", Buffer.from("<svg>source</svg>"), "text"],
        [
            "png",
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHioAAAAASUVORK5CYII=",
                "base64"
            ),
            "image"
        ],
        ["binary", Buffer.from([255, 0, 254]), "unavailable"]
    ])("classifies %s using captured bytes", async (_, bytes, kind) => {
        vi.spyOn(AssetFileOperations, "resolvePath").mockResolvedValue({
            graphRoot: "/graph",
            graphRelativePath: "assets/storages/plugin/file",
            assetsRelativePath: "storages/plugin/file",
            fullPath: "/graph/assets/storages/plugin/file"
        });
        vi.spyOn(AssetFileOperations, "readForPreview").mockResolvedValue({
            exists: true,
            byteLength: bytes.length,
            bytes
        });
        const [result] = await LogseqAssetDataPrinter.print(["assets/storages/plugin/file"]);
        expect(result.side.exists && result.side.preview.kind).toBe(kind);
        expect(result.comparisonBase64).toBe(bytes.toString("base64"));
    });
    test("wraps read errors with the path", async () => {
        vi.spyOn(AssetFileOperations, "resolvePath").mockRejectedValue(new Error("unsafe path"));
        await expect(LogseqAssetDataPrinter.print(["../bad"])).rejects.toThrow(
            "../bad: unsafe path"
        );
    });
});
