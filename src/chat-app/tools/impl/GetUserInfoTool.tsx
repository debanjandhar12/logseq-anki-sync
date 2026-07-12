import type {AppUserInfo} from "@logseq/libs/dist/LSPlugin";
import dayjs from "dayjs";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {getUserPreferredDayjsFormat} from "src/core/template-engine/getUserPreferredDayjsFormat";
import {getUserTimeZone} from "src/core/template-engine/getUserTimeZone";
import {z} from "zod";

const getUserInfoParameters = z.object({});

type GetUserInfoArgs = z.infer<typeof getUserInfoParameters>;

type GetUserInfoResult =
    | ChatToolSuccessResult<{userInfo: AppUserInfo | null}>
    | ChatToolErrorResult;

export class GetUserInfoTool extends BaseChatToolWithDefaultUI<GetUserInfoArgs, GetUserInfoResult> {
    static readonly NAME = "get_user_info";

    readonly name = GetUserInfoTool.NAME;
    readonly description =
        "Get user's present time, logseq details such as current graph, page, block detail, etc.";
    readonly parameters = getUserInfoParameters;

    async execute(): Promise<ChatToolResponse<GetUserInfoResult>> {
        try {
            const userConfig = await logseq.App.getUserConfigs();
            const graphInfo = await logseq.App.getCurrentGraph();
            const currentPage = await logseq.Editor.getCurrentPage();
            const curentBlock = await logseq.Editor.getCurrentBlock();
            const now = dayjs();
            const dayjsFormat = await getUserPreferredDayjsFormat();
            const userInfo = {
                preferredLanguage: userConfig.preferredLanguage,
                preferredDateFormat: userConfig.preferredDateFormat,
                preferredWorkflow: userConfig.preferredWorkflow,
                currentDateAndTime: now.format(dayjsFormat),
                currentTimeZone: getUserTimeZone(),
                currentGraphName: graphInfo.name,
                currentGraphPath: graphInfo.path,
                currentPageUUID: currentPage?.uuid,
                curentBlockUUID: curentBlock?.uuid
            };
            return ChatToolResponse.success({userInfo});
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to get Logseq user info: ${getErrorMessageFromErrObj(err)}`
            );
        }
    }
}
