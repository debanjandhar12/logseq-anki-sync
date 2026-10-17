import {CommandFileStore} from "src/core/stores/command-file-store/CommandFileStore";
import {commandNameSchema} from "src/core/stores/command-file-store/validation/commandNameSchema";
import {validateCommandFileForSave} from "src/core/stores/command-file-store/validation/validateCommandFileForSave";
import {validateCommandMutation} from "src/core/stores/command-file-store/validation/validateCommandMutation";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const PutCommandFileCommandArgsSchema = z.object({
    commandName: commandNameSchema,
    content: z.string().refine((value) => !!value.trim(), "Command content cannot be empty")
});
export type PutCommandFileCommandArgsInput = z.input<typeof PutCommandFileCommandArgsSchema>;
export type PutCommandFileCommandArgs = z.output<typeof PutCommandFileCommandArgsSchema>;
export const PutCommandFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalContent: z.string().nullable().optional()
});
export type PutCommandFileCommandState = z.output<typeof PutCommandFileCommandStateSchema>;

/** Upserts raw command markdown and serializes the original content (or absence) for undo. */
export class PutCommandFileCommand extends BaseReversibleCommand<PutCommandFileCommandState> {
    public readonly args: PutCommandFileCommandArgs;

    public constructor(
        args: PutCommandFileCommandArgsInput,
        commandState?: PutCommandFileCommandState
    ) {
        super(PutCommandFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = PutCommandFileCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const next = await validateCommandFileForSave(this.args.content);
        if (next.name !== this.args.commandName)
            throw new Error("Command name must match content frontmatter name");
        await StoredFileOperations.assertCommandDestinationAvailable(this.args.commandName);
        const original = await StoredFileOperations.readCommandContent(this.args.commandName);
        const issue = validateCommandMutation(original, this.args.content);
        if (issue) throw new Error(issue);
        const changedPath = StoredFileOperations.getGraphRelativePath(
            `commands/${CommandFileStore.getCommandFileName({name: this.args.commandName})}`
        );
        this.commandState.originalContent = original ?? null;
        await CommandFileStore.saveCommandFile(this.args.content);
        this.changedAssets.push(changedPath);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const original = this.commandState.originalContent;
        if (original === undefined) throw new Error("Missing original command content");
        if (original === null)
            await CommandFileStore.deleteCommandFile(
                CommandFileStore.getCommandFileName({name: this.args.commandName})
            );
        else await CommandFileStore.saveCommandFile(original);
        this.commandState.status = "new";
    }
}

export const PutCommandFileCommandCodec = createReversibleCommandCodec({
    type: "PutCommandFile",
    argsSchema: PutCommandFileCommandArgsSchema,
    commandStateSchema: PutCommandFileCommandStateSchema,
    commandClass: PutCommandFileCommand
});
