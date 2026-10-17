import {commandNameSchema} from "src/core/stores/command-file-store/validation/commandNameSchema";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const ReadCommandFileCommandArgsSchema = z.object({commandName: commandNameSchema});
export type ReadCommandFileCommandArgsInput = z.input<typeof ReadCommandFileCommandArgsSchema>;
export type ReadCommandFileCommandArgs = z.output<typeof ReadCommandFileCommandArgsSchema>;
export type ReadCommandFileCommandResult = {exists: boolean; content: string | null};
export const ReadCommandFileCommandStateSchema = z.object({status: z.enum(["new", "executed"])});
export type ReadCommandFileCommandState = z.output<typeof ReadCommandFileCommandStateSchema>;

export class ReadCommandFileCommand extends BaseReversibleCommand<ReadCommandFileCommandState> {
    public readonly args: ReadCommandFileCommandArgs;

    public constructor(
        args: ReadCommandFileCommandArgsInput,
        commandState?: ReadCommandFileCommandState
    ) {
        super(ReadCommandFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = ReadCommandFileCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadCommandFileCommandResult> {
        this.assertCanExecute();
        const content = await StoredFileOperations.readCommandContent(this.args.commandName);
        this.commandState.status = "executed";
        return {exists: content !== undefined, content: content ?? null};
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }

    public doesGraphMutations(): boolean {
        return false;
    }
}

export const ReadCommandFileCommandCodec = createReversibleCommandCodec({
    type: "ReadCommandFile",
    argsSchema: ReadCommandFileCommandArgsSchema,
    commandStateSchema: ReadCommandFileCommandStateSchema,
    commandClass: ReadCommandFileCommand
});
