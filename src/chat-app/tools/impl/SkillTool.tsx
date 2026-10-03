import path from "path-browserify";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {getStorageMountPath} from "src/core/just-bash-wrapper/utils/fsPaths";
import {renderSkillFileTemplate} from "src/core/skill-parser";
import {skillNameSchema} from "src/core/skill-parser/skillMetadataSchema";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {z} from "zod";

const readSkillFileParameters = z.object({
    name: skillNameSchema.describe("Name of the skill to load from the available skills list.")
});

type SkillArgs = z.infer<typeof readSkillFileParameters>;

type SkillResult = ChatToolSuccessResult<{skillFileContent: string}> | ChatToolErrorResult;

export class SkillTool extends BaseChatToolWithDefaultUI<SkillArgs, SkillResult> {
    static readonly NAME = "skill";

    readonly name = SkillTool.NAME;
    readonly description = "Loads stored specialized skill instructions";
    readonly parameters = readSkillFileParameters;

    async execute({name}: SkillArgs): Promise<ChatToolResponse<SkillResult>> {
        try {
            const skillFile = await SkillStore.getSkill(name);
            if (!skillFile) {
                return ChatToolResponse.error(`Skill file not found: ${name}`);
            }

            const renderedContent = await renderSkillFileTemplate(skillFile.content);
            const baseDirectory = getStorageMountPath(SkillStore.groupName, name);
            const files = (await SkillStore.listSkillFiles(name))
                .filter((file) => path.basename(file) !== "SKILL.md")
                .sort()
                .slice(0, 10)
                .map((file) => {
                    const virtualPath = getStorageMountPath(
                        SkillStore.groupName,
                        `${name}/${file}`
                    );
                    const escapedPath = virtualPath
                        .replaceAll("&", "&amp;")
                        .replaceAll("<", "&lt;")
                        .replaceAll(">", "&gt;")
                        .replaceAll('"', "&quot;")
                        .replaceAll("'", "&apos;");
                    return `<file>${escapedPath}</file>`;
                });
            const skillFileContent = [
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
            return ChatToolResponse.success({skillFileContent});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read skill file ${name}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
