import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {renderSkillFileTemplate} from "src/core/skill-parser";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {z} from "zod";

const readSkillFileParameters = z.object({
    fileName: z.string().describe("Name of the skill whose SKILL.md instructions to read.")
});

type SkillArgs = z.infer<typeof readSkillFileParameters>;

type SkillResult = ChatToolSuccessResult<{skillFileContent: string}> | ChatToolErrorResult;

export class SkillTool extends BaseChatToolWithDefaultUI<SkillArgs, SkillResult> {
    static readonly NAME = "skill";

    readonly name = SkillTool.NAME;
    readonly description = "Loads stored specialized skill instructions";
    readonly parameters = readSkillFileParameters;

    async execute({fileName}: SkillArgs): Promise<ChatToolResponse<SkillResult>> {
        try {
            const skillFile = await SkillStore.getSkill(fileName);
            if (!skillFile) {
                return ChatToolResponse.error(`Skill file not found: ${fileName}`);
            }

            const skillFileContent = await renderSkillFileTemplate(skillFile.content);
            return ChatToolResponse.success({skillFileContent});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read skill file ${fileName}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
