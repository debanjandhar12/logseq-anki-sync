import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {SkillFileStore} from "src/core/stores/skill-file-store/SkillFileStore";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";
import {z} from "zod";

const readSkillFileParameters = z.object({
    fileName: z.string().describe("Name of the skill file to read.")
});

type SkillArgs = z.infer<typeof readSkillFileParameters>;

type SkillResult =
    | {
          success: true;
          skillFileContent: string;
      }
    | {
          success: false;
          error: string;
      };

export class SkillTool extends BaseChatToolWithDefaultUI<
    SkillArgs,
    SkillResult
> {
    static readonly NAME = "skill";

    readonly name = SkillTool.NAME;
    readonly description = "Loads stored specialized skill instructions";
    readonly parameters = readSkillFileParameters;

    async execute({fileName}: SkillArgs): Promise<SkillResult> {
        try {
            const skillFile = await SkillFileStore.getSkillFile(fileName);
            if (!skillFile) {
                return {success: false, error: `Skill file not found: ${fileName}`};
            }

            return {success: true, skillFileContent: skillFile.content};
        } catch (err) {
            return {
                success: false,
                error: `Failed to read skill file ${fileName}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
