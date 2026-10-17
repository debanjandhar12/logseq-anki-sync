import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {execLogseqReadOnlyCommand} from "src/chat-app/tools/transaction/execLogseqReadOnlyCommand";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    ReadParsedSkillFileCommand,
    type ReadParsedSkillFileCommandResult
} from "src/core/logseq-reversible-transaction-tracker";
import {skillNameSchema} from "src/core/skill-parser/skillNameSchema";
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

    async execute(
        {name}: SkillArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<SkillResult>> {
        try {
            const result = await execLogseqReadOnlyCommand<ReadParsedSkillFileCommandResult>(
                new ReadParsedSkillFileCommand({skillName: name}),
                {signal: context?.abortSignal}
            );
            if (!result.exists) {
                return ChatToolResponse.error(`Skill file not found: ${name}`);
            }
            return ChatToolResponse.success({skillFileContent: result.content});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to read skill file ${name}: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
