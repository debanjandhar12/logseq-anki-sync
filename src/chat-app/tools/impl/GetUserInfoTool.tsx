import type {AppUserInfo} from "@logseq/libs/dist/LSPlugin";
import dayjs from "dayjs";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {getUserPreferredDayjsFormat} from "src/core/template-engine/getUserPreferredDayjsFormat";
import {getUserTimeZone} from "src/core/template-engine/getUserTimeZone";
import {z} from "zod";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";

const getUserInfoParameters = z.object({});

type GetUserInfoArgs = z.infer<typeof getUserInfoParameters>;

type GetUserInfoResult =
    | {
          success: true;
          userInfo: AppUserInfo | null;
      }
    | {
          success: false;
          error: string;
      };

export class GetUserInfoTool extends BaseChatToolWithDefaultUI<GetUserInfoArgs, GetUserInfoResult> {
    static readonly NAME = "GetUserInfo";

    readonly name = GetUserInfoTool.NAME;
    readonly description =
        "Get user's present time, logseq details such as current graph, page, block detail, etc.";
    readonly parameters = getUserInfoParameters;

    async execute(): Promise<GetUserInfoResult> {
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
            return {success: true, userInfo};
        } catch (err) {
            return {
                success: false,
                error: `Failed to get Logseq user info: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
