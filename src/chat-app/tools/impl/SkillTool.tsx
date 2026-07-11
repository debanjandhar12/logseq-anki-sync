import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    ChatToolResponse,
    type ToolErrorResult,
    type ToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {SkillFileStore} from "src/core/stores/skill-file-store/SkillFileStore";
import {z} from "zod";

const readSkillFileParameters = z.object({
    fileName: z.string().describe("Name of the skill file to read.")
});

type SkillArgs = z.infer<typeof readSkillFileParameters>;

type SkillResult = ToolSuccessResult<{skillFileContent: string}> | ToolErrorResult;

export class SkillTool extends BaseChatToolWithDefaultUI<SkillArgs, SkillResult> {
    static readonly NAME = "skill";

    readonly name = SkillTool.NAME;
    readonly description = "Loads stored specialized skill instructions";
    readonly parameters = readSkillFileParameters;

    async execute({fileName}: SkillArgs): Promise<ChatToolResponse<SkillResult>> {
        try {
            const skillFile = await SkillFileStore.getSkillFile(fileName);
            if (!skillFile) {
                return ChatToolResponse.error(`Skill file not found: ${fileName}`);
            }

            return ChatToolResponse.success({skillFileContent: skillFile.content});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read skill file ${fileName}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
