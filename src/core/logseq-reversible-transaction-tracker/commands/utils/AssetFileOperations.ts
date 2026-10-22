import {Buffer} from "buffer";
import {getStreamAsArrayBuffer, MaxBufferError} from "get-stream";
import {MAX_ASSET_DIFF_BYTES} from "src/constants";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";
import {type ResolvedGraphAssetPath, resolveGraphAssetPath} from "./resolveGraphAssetPath";

/** Empty base64 is valid for snapshots of existing zero-byte files. */
export const assetSnapshotSchema = z.discriminatedUnion("exists", [
    z.object({exists: z.literal(false)}),
    z.object({
        exists: z.literal(true),
        contentBase64: z
            .string()
            .refine(
                (value) => z.base64().safeParse(value.trim()).success,
                "Content must be valid padded base64"
            )
    })
]);

export type AssetSnapshot = z.output<typeof assetSnapshotSchema>;

export type AssetPreviewRead =
    | {exists: false}
    | {exists: true; byteLength: number; bytes: Uint8Array}
    | {exists: true; byteLength: number; sizeIsExact: boolean; omitted: true};

/** Desktop asset I/O; commands own lifecycle, write policy, and undo state. */
export class AssetFileOperations {
    public static requireHost(options: {write?: boolean} = {}): void {
        const host = WindowParentBridge.getWindow();
        if (
            typeof host.apis?.doAction !== "function" ||
            typeof host.fetch !== "function" ||
            (options.write &&
                typeof WindowParentBridge.getLogseqObject().api?.write_assetsdir_file !==
                    "function")
        )
            throw new Error(
                "Asset file commands require the Logseq desktop host; web is not supported"
            );
    }

    public static async resolvePath(
        assetPath: string,
        expectedGraphRoot?: string
    ): Promise<ResolvedGraphAssetPath> {
        AssetFileOperations.requireHost();
        const graph = await logseq.App.getCurrentGraph();
        if (!graph?.path) throw new Error("No current graph");
        const resolved = resolveGraphAssetPath(assetPath, graph.path);
        if (expectedGraphRoot !== undefined && resolved.graphRoot !== expectedGraphRoot)
            throw new Error("The current graph changed since this command was executed");
        return resolved;
    }

    public static async readSnapshot(resolved: ResolvedGraphAssetPath): Promise<AssetSnapshot> {
        // Electron's assets protocol can reject fetch rather than return a 404. Check existence
        // separately so permission/network failures are never mistaken for a missing original.
        const exists = await AssetFileOperations.exists(resolved);
        if (!exists) return {exists: false};
        const url = await WindowParentBridge.makeAssetUrl(resolved.graphRelativePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to read asset: ${response.status}`);
        return {
            exists: true,
            contentBase64: Buffer.from(await response.arrayBuffer()).toString("base64")
        };
    }

    public static async write(
        resolved: ResolvedGraphAssetPath,
        contentBase64: string
    ): Promise<void> {
        AssetFileOperations.requireHost({write: true});
        const bytes = Uint8Array.from(Buffer.from(contentBase64.trim(), "base64"));
        const result = await WindowParentBridge.getLogseqObject().api.write_assetsdir_file(
            resolved.assetsRelativePath,
            bytes,
            ""
        );
        if (typeof result !== "string" || !result) throw new Error("Logseq failed to write asset");
    }

    public static async restoreSnapshot(
        resolved: ResolvedGraphAssetPath,
        snapshot: AssetSnapshot
    ): Promise<void> {
        if (snapshot.exists) {
            await AssetFileOperations.write(resolved, snapshot.contentBase64);
        } else {
            const apis = WindowParentBridge.getWindow().apis;
            const exists = await AssetFileOperations.exists(resolved);
            if (exists)
                await apis.doAction(["unlink", resolved.graphRoot, resolved.fullPath, "js-obj"]);
            if (await AssetFileOperations.exists(resolved))
                throw new Error("Logseq failed to remove the created asset");
        }
    }

    public static async readForPreview(
        resolved: ResolvedGraphAssetPath
    ): Promise<AssetPreviewRead> {
        const metadata = await AssetFileOperations.getMetadata(resolved);
        if (!metadata.exists) return {exists: false};
        if (metadata.byteLength > MAX_ASSET_DIFF_BYTES)
            return {...metadata, omitted: true, sizeIsExact: true};
        const url = await WindowParentBridge.makeAssetUrl(resolved.graphRelativePath);
        if (!/^[a-z][a-z\d+.-]*:/i.test(url))
            throw new Error("Logseq did not resolve an asset URL");
        // Both sides use the same URL around rollback; never reuse a cached applied version.
        const response = await fetch(url, {cache: "no-store"});
        if (!response.ok) throw new Error(`Failed to read asset: ${response.status}`);
        if (!response.body) throw new Error("Asset response does not support bounded reading");
        let bytes: Uint8Array;
        try {
            bytes = new Uint8Array(
                await getStreamAsArrayBuffer(response.body, {maxBuffer: MAX_ASSET_DIFF_BYTES})
            );
        } catch (error) {
            if (!(error instanceof MaxBufferError)) throw error;
            // The library truncates bufferedData at the cap; the actual size is at least cap + 1.
            return {
                exists: true,
                omitted: true,
                byteLength: MAX_ASSET_DIFF_BYTES + 1,
                sizeIsExact: false
            };
        }
        const byteLength = bytes.byteLength;
        if (byteLength !== metadata.byteLength)
            throw new Error("Asset size changed while capturing its preview");
        return {exists: true, byteLength, bytes};
    }

    private static async exists(resolved: ResolvedGraphAssetPath): Promise<boolean> {
        return (await AssetFileOperations.getMetadata(resolved)).exists;
    }

    public static async getMetadata(
        resolved: ResolvedGraphAssetPath
    ): Promise<{exists: false} | {exists: true; byteLength: number}> {
        const {fullPath, graphRoot} = resolved;
        try {
            const stat = await WindowParentBridge.getWindow().apis.doAction([
                "stat",
                fullPath,
                "js-obj"
            ]);
            // Some Logseq versions swallow stat errors. A successful directory listing
            // distinguishes absence from a swallowed permission error on an existing file.
            if (stat == null) {
                const files = await WindowParentBridge.getWindow().apis.doAction([
                    "listdir",
                    graphRoot,
                    true,
                    "js-obj"
                ]);
                if (!Array.isArray(files))
                    throw new Error("Unable to inspect the current graph's files");
                const normalize = (value: string) => {
                    const normalized = value.replace(/\\/g, "/");
                    return /^[a-z]:/i.test(fullPath) ? normalized.toLowerCase() : normalized;
                };
                if (
                    files.some(
                        (file) =>
                            typeof file === "string" && normalize(file) === normalize(fullPath)
                    )
                )
                    throw new Error("Unable to read metadata for the existing asset");
                return {exists: false};
            }
            if (!Number.isSafeInteger(stat.size) || stat.size < 0)
                throw new Error("Host did not return asset file metadata");
            return {exists: true, byteLength: stat.size};
        } catch (error) {
            // Electron preserves ENOENT in the IPC error message, but not necessarily its code.
            if (error instanceof Error && /\bENOENT\b/.test(error.message)) return {exists: false};
            throw error;
        }
    }
}
