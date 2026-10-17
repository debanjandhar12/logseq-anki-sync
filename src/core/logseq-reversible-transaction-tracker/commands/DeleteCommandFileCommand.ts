import {CommandFileStore} from "src/core/stores/command-file-store/CommandFileStore";
import {storageSafeCommandNameSchema} from "src/core/stores/command-file-store/validation/commandNameSchema";
import {validateCommandMutation} from "src/core/stores/command-file-store/validation/validateCommandMutation";
import {LogseqPluginStorageManager as Storage} from "src/logseq/LogseqPluginStorageManager";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const DeleteCommandFileCommandArgsSchema = z.object({
    commandName: storageSafeCommandNameSchema
});
export type DeleteCommandFileCommandArgsInput = z.input<typeof DeleteCommandFileCommandArgsSchema>;
export type DeleteCommandFileCommandArgs = z.output<typeof DeleteCommandFileCommandArgsSchema>;
export const DeleteCommandFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalContent: z.string().optional()
});
export type DeleteCommandFileCommandState = z.output<typeof DeleteCommandFileCommandStateSchema>;

export class DeleteCommandFileCommand extends BaseReversibleCommand<DeleteCommandFileCommandState> {
    public readonly args: DeleteCommandFileCommandArgs;

    public constructor(
        args: DeleteCommandFileCommandArgsInput,
        commandState?: DeleteCommandFileCommandState
    ) {
        super(DeleteCommandFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = DeleteCommandFileCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const original = await StoredFileOperations.readCommandContent(this.args.commandName);
        if (original === undefined)
            throw new Error(`Command does not exist: ${this.args.commandName}`);
        const issue = validateCommandMutation(original, undefined);
        if (issue) throw new Error(issue);
        const fileName = CommandFileStore.getCommandFileName({name: this.args.commandName});
        const changedPath = StoredFileOperations.getGraphRelativePath(`commands/${fileName}`);
        this.commandState.originalContent = original;
        await CommandFileStore.deleteCommandFile(fileName);
        this.changedAssets.push(changedPath);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        if (this.commandState.originalContent === undefined)
            throw new Error("Missing original command content");
        await Storage.saveFile(
            CommandFileStore.groupName,
            CommandFileStore.getCommandFileName({name: this.args.commandName}),
            this.commandState.originalContent
        );
        this.commandState.status = "new";
    }
}

export const DeleteCommandFileCommandCodec = createReversibleCommandCodec({
    type: "DeleteCommandFile",
    argsSchema: DeleteCommandFileCommandArgsSchema,
    commandStateSchema: DeleteCommandFileCommandStateSchema,
    commandClass: DeleteCommandFileCommand
});
