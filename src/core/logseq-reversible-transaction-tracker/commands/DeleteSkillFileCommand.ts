import {skillNameSchema} from "src/core/skill-parser/skillNameSchema";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {validateSkillMutation} from "src/core/stores/skill-store/validation/validateSkillMutation";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {StoredFileOperations} from "./utils/StoredFileOperations";

export const DeleteSkillFileCommandArgsSchema = z.object({skillName: skillNameSchema});
export type DeleteSkillFileCommandArgsInput = z.input<typeof DeleteSkillFileCommandArgsSchema>;
export type DeleteSkillFileCommandArgs = z.output<typeof DeleteSkillFileCommandArgsSchema>;
export const DeleteSkillFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalFiles: z.record(z.string(), z.string()).optional()
});
export type DeleteSkillFileCommandState = z.output<typeof DeleteSkillFileCommandStateSchema>;

/** Deletes the whole skill folder. Every relative path and raw text is serialized for undo. */
export class DeleteSkillFileCommand extends BaseReversibleCommand<DeleteSkillFileCommandState> {
    public readonly args: DeleteSkillFileCommandArgs;

    public constructor(
        args: DeleteSkillFileCommandArgsInput,
        commandState?: DeleteSkillFileCommandState
    ) {
        super(DeleteSkillFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = DeleteSkillFileCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const files = await SkillStore.getSkillFiles(this.args.skillName);
        if (files["SKILL.md"] === undefined)
            throw new Error(`Skill does not exist: ${this.args.skillName}`);
        const issue = validateSkillMutation(files["SKILL.md"], undefined);
        if (issue) throw new Error(issue);
        const paths = Object.keys(files).map((file) =>
            StoredFileOperations.getGraphRelativePath(`skills/${this.args.skillName}/${file}`)
        );
        this.commandState.originalFiles = files;
        await SkillStore.deleteSkill(this.args.skillName);
        this.changedAssets.push(...paths);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        if (!this.commandState.originalFiles) throw new Error("Missing original skill folder");
        await SkillStore.saveSkillFile({
            skillName: this.args.skillName,
            files: this.commandState.originalFiles
        });
        this.commandState.status = "new";
    }
}

export const DeleteSkillFileCommandCodec = createReversibleCommandCodec({
    type: "DeleteSkillFile",
    argsSchema: DeleteSkillFileCommandArgsSchema,
    commandStateSchema: DeleteSkillFileCommandStateSchema,
    commandClass: DeleteSkillFileCommand
});
