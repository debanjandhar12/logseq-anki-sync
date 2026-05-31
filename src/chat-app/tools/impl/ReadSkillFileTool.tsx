import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {SkillFileStore} from "src/core/stores/skill-file-store/SkillFileStore";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";
import {z} from "zod";

const readSkillFileParameters = z.object({
    fileName: z.string().describe("Name of the skill file to read.")
});

type ReadSkillFileArgs = z.infer<typeof readSkillFileParameters>;

type ReadSkillFileResult =
    | {
          success: true;
          skillFileContent: string;
      }
    | {
          success: false;
          error: string;
      };

export class ReadSkillFileTool extends BaseChatToolWithDefaultUI<
    ReadSkillFileArgs,
    ReadSkillFileResult
> {
    static readonly NAME = "ReadSkillFile";

    readonly name = ReadSkillFileTool.NAME;
    readonly description = "Read a stored skill file by file name.";
    readonly parameters = readSkillFileParameters;

    async execute({fileName}: ReadSkillFileArgs): Promise<ReadSkillFileResult> {
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
