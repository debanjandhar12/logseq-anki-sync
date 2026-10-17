import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {AssetFileOperations} from "./utils/AssetFileOperations";

export const ReadAssetFileCommandArgsSchema = z.object({
    assetPath: z
        .string()
        .min(1)
        .describe(
            "Graph-relative assets/ path or absolute path inside the current graph's assets directory."
        )
});
export type ReadAssetFileCommandArgsInput = z.input<typeof ReadAssetFileCommandArgsSchema>;
export type ReadAssetFileCommandArgs = z.output<typeof ReadAssetFileCommandArgsSchema>;
export type ReadAssetFileCommandResult = {exists: boolean; contentBase64: string | null};
export const ReadAssetFileCommandStateSchema = z.object({status: z.enum(["new", "executed"])});
export type ReadAssetFileCommandState = z.output<typeof ReadAssetFileCommandStateSchema>;

export class ReadAssetFileCommand extends BaseReversibleCommand<ReadAssetFileCommandState> {
    public readonly args: ReadAssetFileCommandArgs;

    public constructor(
        args: ReadAssetFileCommandArgsInput,
        commandState?: ReadAssetFileCommandState
    ) {
        super(ReadAssetFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = ReadAssetFileCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadAssetFileCommandResult> {
        this.assertCanExecute();
        const snapshot = await AssetFileOperations.readSnapshot(
            await AssetFileOperations.resolvePath(this.args.assetPath)
        );
        this.commandState.status = "executed";
        return {
            exists: snapshot.exists,
            contentBase64: snapshot.exists ? snapshot.contentBase64 : null
        };
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }

    public doesGraphMutations(): boolean {
        return false;
    }
}

export const ReadAssetFileCommandCodec = createReversibleCommandCodec({
    type: "ReadAssetFile",
    argsSchema: ReadAssetFileCommandArgsSchema,
    commandStateSchema: ReadAssetFileCommandStateSchema,
    commandClass: ReadAssetFileCommand
});
