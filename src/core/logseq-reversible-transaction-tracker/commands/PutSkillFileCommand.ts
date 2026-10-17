import {skillNameSchema} from "src/core/skill-parser/skillNameSchema";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {validateSkillFileForSave} from "src/core/stores/skill-store/validation/validateSkillFileForSave";
import {validateSkillMutation} from "src/core/stores/skill-store/validation/validateSkillMutation";
import {LogseqPluginStorageManager as Storage} from "src/logseq/LogseqPluginStorageManager";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const PutSkillFileCommandArgsSchema = z.object({
    skillName: skillNameSchema,
    content: z.string().refine((value) => !!value.trim(), "Skill content cannot be empty")
});
export type PutSkillFileCommandArgsInput = z.input<typeof PutSkillFileCommandArgsSchema>;
export type PutSkillFileCommandArgs = z.output<typeof PutSkillFileCommandArgsSchema>;
export const PutSkillFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalContent: z.string().nullable().optional()
});
export type PutSkillFileCommandState = z.output<typeof PutSkillFileCommandStateSchema>;

/** Changes SKILL.md only; the original raw content (or absence) is serialized for undo. */
export class PutSkillFileCommand extends BaseReversibleCommand<PutSkillFileCommandState> {
    public readonly args: PutSkillFileCommandArgs;

    public constructor(
        args: PutSkillFileCommandArgsInput,
        commandState?: PutSkillFileCommandState
    ) {
        super(PutSkillFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = PutSkillFileCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const next = await validateSkillFileForSave(this.args.content);
        if (next.name !== this.args.skillName)
            throw new Error("Skill name must match content frontmatter name");
        const original = await StoredFileOperations.readSkillContent(this.args.skillName);
        const issue = validateSkillMutation(original, this.args.content);
        if (issue) throw new Error(issue);
        const changedPath = StoredFileOperations.getGraphRelativePath(
            `skills/${this.args.skillName}/SKILL.md`
        );
        this.commandState.originalContent = original ?? null;
        await SkillStore.saveSkillFile(this.args.content);
        this.changedAssets.push(changedPath);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const original = this.commandState.originalContent;
        if (original === undefined) throw new Error("Missing original skill content");
        if (original === null)
            await Storage.deleteFile(`skills/${this.args.skillName}`, "SKILL.md");
        else await SkillStore.saveSkillFile(original);
        this.commandState.status = "new";
    }
}

export const PutSkillFileCommandCodec = createReversibleCommandCodec({
    type: "PutSkillFile",
    argsSchema: PutSkillFileCommandArgsSchema,
    commandStateSchema: PutSkillFileCommandStateSchema,
    commandClass: PutSkillFileCommand
});
