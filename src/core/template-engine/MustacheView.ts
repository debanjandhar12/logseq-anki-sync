import dayjs from "dayjs";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR} from "../../constants";
import {LogseqEditor} from "../../logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {getModelInvokableSkillListString} from "./getModelInvokableSkillListString";
import {getUserPreferredDayjsFormat} from "./getUserPreferredDayjsFormat";
import {getUserTimeZone} from "./getUserTimeZone";

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
} as const;

function getLastWeekday(date: dayjs.Dayjs, weekdayIndex: number): dayjs.Dayjs {
    const daysSinceWeekday = (date.day() - weekdayIndex + 7) % 7 || 7;
    return date.subtract(daysSinceWeekday, "day");
}

export type MustacheTemplateView = Record<string, string>;

export function createCaseInsensitiveMustacheView(
    view: MustacheTemplateView
): MustacheTemplateView {
    const normalizedView = Object.fromEntries(
        Object.entries(view).map(([key, value]) => [key.toLowerCase(), value])
    );

    return new Proxy(view, {
        get: (target, property) => {
            if (typeof property !== "string") return Reflect.get(target, property);

            return target[property] ?? normalizedView[property.toLowerCase()];
        },
        has: (target, property) => {
            if (typeof property !== "string") return property in target;

            return property in target || property.toLowerCase() in normalizedView;
        }
    });
}

export async function createMustacheView(date: Date = new Date()): Promise<MustacheTemplateView> {
    const now = dayjs(date);
    const additionalSystemMessage =
        LogseqSettingAccessor.getPluginSettings().globalAgentInstruction?.trim() ?? "";
    const currentPage = await LogseqEditor.getCurrentPage();
    const currentEditingBlock = await LogseqEditor.getCurrentEditingBlock();
    const dayjsFormat = await getUserPreferredDayjsFormat();
    const modelInvokableSkillList = await getModelInvokableSkillListString();

    const view: MustacheTemplateView = {
        "additional system message": additionalSystemMessage,
        "current page": currentPage ? currentPage.uuid : "No current page",
        "current editing block": currentEditingBlock?.uuid ?? "No current editing block",
        "model invokable skill list": modelInvokableSkillList,
        additionalsystemmessage: additionalSystemMessage,
        additionalSystemMessage,
        chatAppAgentToolResultMaxChar: String(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR),
        currentpage: currentPage ? currentPage.uuid : "No current page",
        currenteditingblock: currentEditingBlock?.uuid ?? "No current editing block",
        modelinvokableskilllist: modelInvokableSkillList,
        time: now.format("HH:mm"),
        today: now.format(dayjsFormat),
        tomorrow: now.add(1, "day").format(dayjsFormat),
        userTimeZone: getUserTimeZone(),
        yesterday: now.subtract(1, "day").format(dayjsFormat)
    };

    for (const [weekdayName, weekdayIndex] of Object.entries(WEEKDAY_INDEX_BY_NAME)) {
        view[`last ${weekdayName}`] = getLastWeekday(now, weekdayIndex).format(dayjsFormat);
    }

    return createCaseInsensitiveMustacheView(view);
}
