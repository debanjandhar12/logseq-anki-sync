import {Buffer} from "buffer";
import {fileTypeFromBuffer} from "file-type";
import {AssetFileOperations} from "./commands/utils/AssetFileOperations";

export type AssetPreview =
    | {kind: "text"; content: string}
    | {kind: "image"; mimeType: string; contentBase64: string}
    | {kind: "unavailable"; reason: "binary" | "too-large"};

export type AssetChangeSide =
    | {exists: false}
    | {exists: true; byteLength: number; sizeIsExact: boolean; preview: AssetPreview};

export interface LogseqPrintedAssetSnapshot {
    assetPath: string;
    side: AssetChangeSide;
    comparisonBase64?: string;
}

export interface LogseqPrintedAssetChange {
    key: string;
    assetPath: string;
    status: "added" | "modified" | "deleted";
    comparison: "different" | "unknown";
    before: AssetChangeSide;
    after: AssetChangeSide;
}

/** Captures graph files while applied, so previews survive transaction rollback. */
export class LogseqAssetDataPrinter {
    public static async print(paths: string[]): Promise<LogseqPrintedAssetSnapshot[]> {
        const snapshots = new Map<string, LogseqPrintedAssetSnapshot>();
        for (const path of paths) {
            try {
                const resolved = await AssetFileOperations.resolvePath(path);
                const assetPath = resolved.graphRelativePath;
                if (snapshots.has(assetPath)) continue;
                const read = await AssetFileOperations.readForPreview(resolved);
                if (!read.exists) {
                    snapshots.set(assetPath, {assetPath, side: {exists: false}});
                } else if ("omitted" in read) {
                    snapshots.set(assetPath, {
                        assetPath,
                        side: {
                            exists: true,
                            byteLength: read.byteLength,
                            sizeIsExact: read.sizeIsExact,
                            preview: {kind: "unavailable", reason: "too-large"}
                        }
                    });
                } else {
                    const comparisonBase64 = Buffer.from(read.bytes).toString("base64");
                    snapshots.set(assetPath, {
                        assetPath,
                        comparisonBase64,
                        side: {
                            exists: true,
                            byteLength: read.byteLength,
                            sizeIsExact: true,
                            preview: await classifyPreview(read.bytes, comparisonBase64)
                        }
                    });
                }
            } catch (error) {
                throw new Error(
                    `Failed to capture asset ${path}: ${error instanceof Error ? error.message : String(error)}`,
                    {cause: error}
                );
            }
        }
        return [...snapshots.values()];
    }

    public static createChanges(
        before: LogseqPrintedAssetSnapshot[],
        after: LogseqPrintedAssetSnapshot[]
    ): LogseqPrintedAssetChange[] {
        const beforeByPath = new Map(before.map((snapshot) => [snapshot.assetPath, snapshot]));
        const afterByPath = new Map(after.map((snapshot) => [snapshot.assetPath, snapshot]));
        if (
            beforeByPath.size !== before.length ||
            afterByPath.size !== after.length ||
            before.length !== after.length ||
            before.some((snapshot) => !afterByPath.has(snapshot.assetPath))
        )
            throw new Error("Cannot pair asset snapshots with different or duplicate paths");
        return before.flatMap((original) => {
            const updated = afterByPath.get(original.assetPath)!;
            if (!original.side.exists && !updated.side.exists) return [];
            const capturedBoth =
                original.comparisonBase64 !== undefined && updated.comparisonBase64 !== undefined;
            if (capturedBoth && original.comparisonBase64 === updated.comparisonBase64) return [];
            return [
                {
                    key: `changed-asset-${original.assetPath}`,
                    assetPath: original.assetPath,
                    status: !original.side.exists
                        ? "added"
                        : !updated.side.exists
                          ? "deleted"
                          : "modified",
                    comparison:
                        capturedBoth || !original.side.exists || !updated.side.exists
                            ? "different"
                            : "unknown",
                    before: original.side,
                    after: updated.side
                }
            ];
        });
    }
}

const PREVIEW_IMAGE_TYPES = new Set(["png", "apng", "jpg", "gif", "webp", "bmp", "ico", "avif"]);

async function classifyPreview(bytes: Uint8Array, contentBase64: string): Promise<AssetPreview> {
    // Truncated/malformed files can reject detection; keep them reviewable as binary.
    const detected = await fileTypeFromBuffer(bytes).catch(() => undefined);
    if (detected && PREVIEW_IMAGE_TYPES.has(detected.ext))
        return {kind: "image", mimeType: detected.mime, contentBase64};
    try {
        const content = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
        if (!bytes.some((byte) => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13))
            return {kind: "text", content};
    } catch {
        // Invalid UTF-8 is binary, not a lossy text preview.
    }
    return {kind: "unavailable", reason: "binary"};
}
