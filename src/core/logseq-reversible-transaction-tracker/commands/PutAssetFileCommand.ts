import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {AssetFileOperations, assetSnapshotSchema} from "./utils/AssetFileOperations";

export const PutAssetFileCommandArgsSchema = z.object({
    assetPath: z
        .string()
        .min(1)
        .describe(
            "Graph-relative assets/ path or absolute path inside the current graph's assets directory."
        ),
    contentBase64: z
        .string()
        .refine((value) => value.trim().length > 0, "Asset content cannot be empty")
        .refine(
            (value) => z.base64().safeParse(value.trim()).success,
            "Content must be valid padded base64"
        )
});
export type PutAssetFileCommandArgsInput = z.input<typeof PutAssetFileCommandArgsSchema>;
export type PutAssetFileCommandArgs = z.output<typeof PutAssetFileCommandArgsSchema>;
export const PutAssetFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalAsset: assetSnapshotSchema.optional(),
    graphRoot: z.string().optional(),
    assetPath: z.string().optional()
});
export type PutAssetFileCommandState = z.output<typeof PutAssetFileCommandStateSchema>;

/** Upserts bytes without creating or modifying a Logseq database asset block. Undo bytes are serialized. */
export class PutAssetFileCommand extends BaseReversibleCommand<PutAssetFileCommandState> {
    public readonly args: PutAssetFileCommandArgs;

    public constructor(
        args: PutAssetFileCommandArgsInput,
        commandState?: PutAssetFileCommandState
    ) {
        super(PutAssetFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = PutAssetFileCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        AssetFileOperations.requireHost({write: true});
        const resolved = await AssetFileOperations.resolvePath(
            this.commandState.assetPath ?? this.args.assetPath,
            this.commandState.graphRoot
        );
        if (
            resolved.assetsRelativePath
                .toLowerCase()
                .startsWith(`storages/${logseq.baseInfo.id}/`.toLowerCase())
        )
            throw new Error("Use dedicated commands to modify this plugin's storage files");
        this.commandState.originalAsset = await AssetFileOperations.readSnapshot(resolved);
        this.commandState.graphRoot = resolved.graphRoot;
        this.commandState.assetPath = resolved.graphRelativePath;
        try {
            await AssetFileOperations.write(resolved, this.args.contentBase64);
        } catch (error) {
            try {
                await AssetFileOperations.restoreSnapshot(
                    resolved,
                    this.commandState.originalAsset
                );
            } catch (rollbackError) {
                throw new AggregateError([error, rollbackError], "Asset write and rollback failed");
            }
            throw error;
        }
        this.changedAssets.push(resolved.graphRelativePath);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        if (
            !this.commandState.originalAsset ||
            !this.commandState.graphRoot ||
            !this.commandState.assetPath
        )
            throw new Error("Missing original asset snapshot");
        const resolved = await AssetFileOperations.resolvePath(
            this.commandState.assetPath,
            this.commandState.graphRoot
        );
        await AssetFileOperations.restoreSnapshot(resolved, this.commandState.originalAsset);
        this.commandState.status = "new";
    }
}

export const PutAssetFileCommandCodec = createReversibleCommandCodec({
    type: "PutAssetFile",
    argsSchema: PutAssetFileCommandArgsSchema,
    commandStateSchema: PutAssetFileCommandStateSchema,
    commandClass: PutAssetFileCommand
});
