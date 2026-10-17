import {skillNameSchema} from "src/core/skill-parser/skillNameSchema";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const ReadSkillFileCommandArgsSchema = z.object({skillName: skillNameSchema});
export type ReadSkillFileCommandArgsInput = z.input<typeof ReadSkillFileCommandArgsSchema>;
export type ReadSkillFileCommandArgs = z.output<typeof ReadSkillFileCommandArgsSchema>;

export type ReadSkillFileCommandResult = {exists: boolean; content: string | null};

export const ReadSkillFileCommandStateSchema = z.object({status: z.enum(["new", "executed"])});
export type ReadSkillFileCommandState = z.output<typeof ReadSkillFileCommandStateSchema>;

/** Reads exact markdown without template rendering or parsing away malformed content. */
export class ReadSkillFileCommand extends BaseReversibleCommand<ReadSkillFileCommandState> {
    public readonly args: ReadSkillFileCommandArgs;

    public constructor(
        args: ReadSkillFileCommandArgsInput,
        commandState?: ReadSkillFileCommandState
    ) {
        super(ReadSkillFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = ReadSkillFileCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadSkillFileCommandResult> {
        this.assertCanExecute();
        const content = await StoredFileOperations.readSkillContent(this.args.skillName);
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

export const ReadSkillFileCommandCodec = createReversibleCommandCodec({
    type: "ReadSkillFile",
    argsSchema: ReadSkillFileCommandArgsSchema,
    commandStateSchema: ReadSkillFileCommandStateSchema,
    commandClass: ReadSkillFileCommand
});
