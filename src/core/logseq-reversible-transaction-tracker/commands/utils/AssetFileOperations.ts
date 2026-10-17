import {Buffer} from "buffer";
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
        const response = await WindowParentBridge.getFetch()(url);
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

    private static async exists(resolved: ResolvedGraphAssetPath): Promise<boolean> {
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
                return false;
            }
            if (!stat || typeof stat.size !== "number")
                throw new Error("Host did not return asset file metadata");
            return true;
        } catch (error) {
            // Electron preserves ENOENT in the IPC error message, but not necessarily its code.
            if (error instanceof Error && /\bENOENT\b/.test(error.message)) return false;
            throw error;
        }
    }
}
