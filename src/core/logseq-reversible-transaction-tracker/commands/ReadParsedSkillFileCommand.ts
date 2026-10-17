import path from "path-browserify";
import {getStorageMountPath} from "src/core/just-bash-wrapper/utils/fsPaths";
import {renderSkillFileTemplate} from "src/core/skill-parser";
import {skillNameSchema} from "src/core/skill-parser/skillNameSchema";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";

export const ReadParsedSkillFileCommandArgsSchema = z.object({skillName: skillNameSchema});
export type ReadParsedSkillFileCommandArgsInput = z.input<
    typeof ReadParsedSkillFileCommandArgsSchema
>;
export type ReadParsedSkillFileCommandArgs = z.output<typeof ReadParsedSkillFileCommandArgsSchema>;

/** Missing or invalid skills do not exist; content is the complete rendered skill wrapper. */
export type ReadParsedSkillFileCommandResult =
    | {exists: true; content: string}
    | {exists: false; content: null};

export const ReadParsedSkillFileCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type ReadParsedSkillFileCommandState = z.output<
    typeof ReadParsedSkillFileCommandStateSchema
>;

/** Loads validated skill instructions, renders templates, and advertises sampled resource paths. */
export class ReadParsedSkillFileCommand extends BaseReversibleCommand<ReadParsedSkillFileCommandState> {
    public readonly args: ReadParsedSkillFileCommandArgs;

    public constructor(
        args: ReadParsedSkillFileCommandArgsInput,
        commandState?: ReadParsedSkillFileCommandState
    ) {
        super(ReadParsedSkillFileCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = ReadParsedSkillFileCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadParsedSkillFileCommandResult> {
        this.assertCanExecute();
        const result = await this.read();
        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }

    public doesGraphMutations(): boolean {
        return false;
    }

    private async read(): Promise<ReadParsedSkillFileCommandResult> {
        const name = this.args.skillName;
        const skillFile = await SkillStore.getSkill(name);
        if (!skillFile) return {exists: false, content: null};

        const renderedContent = await renderSkillFileTemplate(skillFile.content);
        const baseDirectory = getStorageMountPath(SkillStore.groupName, name);
        const files = (await SkillStore.listSkillFiles(name))
            .filter((file) => path.basename(file) !== "SKILL.md")
            .sort()
            .slice(0, 10)
            .map((file) => {
                const virtualPath = getStorageMountPath(SkillStore.groupName, `${name}/${file}`);
                const escapedPath = virtualPath
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")
                    .replaceAll('"', "&quot;")
                    .replaceAll("'", "&apos;");
                return `<file>${escapedPath}</file>`;
            });
        const content = [
            `<skill_content name="${name}">`,
            `# Skill: ${name}`,
            "",
            renderedContent,
            "",
            `Base directory for this skill: ${baseDirectory}`,
            "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
            "Note: file list is sampled.",
            "",
            "<skill_files>",
            ...files,
            "</skill_files>",
            "</skill_content>"
        ].join("\n");
        return {exists: true, content};
    }
}

export const ReadParsedSkillFileCommandCodec = createReversibleCommandCodec({
    type: "ReadParsedSkillFile",
    argsSchema: ReadParsedSkillFileCommandArgsSchema,
    commandStateSchema: ReadParsedSkillFileCommandStateSchema,
    commandClass: ReadParsedSkillFileCommand
});
