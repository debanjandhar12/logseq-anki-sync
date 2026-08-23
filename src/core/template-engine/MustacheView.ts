import dayjs from "dayjs";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR} from "../../constants";
import {LogseqEditor} from "../../logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {getModelInvokableSkillListString} from "./getModelInvokableSkillListString";
import {getUserPreferredDayjsFormat} from "./getUserPreferredDayjsFormat";
import {getUserTimeZone} from "./getUserTimeZone";

const WEEKDAYS = [
    ["Sunday", 0],
    ["Monday", 1],
    ["Tuesday", 2],
    ["Wednesday", 3],
    ["Thursday", 4],
    ["Friday", 5],
    ["Saturday", 6]
] as const;

function getLastWeekday(date: dayjs.Dayjs, weekdayIndex: number): dayjs.Dayjs {
    const daysSinceWeekday = (date.day() - weekdayIndex + 7) % 7 || 7;
    return date.subtract(daysSinceWeekday, "day");
}

export type MustacheTemplateView = Record<string, string>;

export interface MustacheViewValues {
    globalAgentInstruction: string;
    currentPage: string;
    currentEditingBlock: string;
    modelInvokableSkillList: string;
    chatAppAgentToolResultMaxChar: string;
    time: string;
    today: string;
    tomorrow: string;
    yesterday: string;
    userTimeZone: string;
    lastWeekdays: Record<(typeof WEEKDAYS)[number][0], string>;
}

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

export function createMustacheViewFromValues(values: MustacheViewValues): MustacheTemplateView {
    const view: MustacheTemplateView = {
        globalAgentInstruction: values.globalAgentInstruction,
        currentPage: values.currentPage,
        currentEditingBlock: values.currentEditingBlock,
        modelInvokableSkillList: values.modelInvokableSkillList,
        chatAppAgentToolResultMaxChar: values.chatAppAgentToolResultMaxChar,
        time: values.time,
        today: values.today,
        tomorrow: values.tomorrow,
        yesterday: values.yesterday,
        userTimeZone: values.userTimeZone
    };

    for (const [weekday] of WEEKDAYS) {
        view[`last ${weekday.toLowerCase()}`] = values.lastWeekdays[weekday];
    }

    return createCaseInsensitiveMustacheView(view);
}

const EMPTY_MUSTACHE_VIEW_VALUES: MustacheViewValues = {
    globalAgentInstruction: "",
    currentPage: "",
    currentEditingBlock: "",
    modelInvokableSkillList: "",
    chatAppAgentToolResultMaxChar: "",
    time: "",
    today: "",
    tomorrow: "",
    yesterday: "",
    userTimeZone: "",
    lastWeekdays: Object.fromEntries(WEEKDAYS.map(([weekday]) => [weekday, ""])) as Record<
        (typeof WEEKDAYS)[number][0],
        string
    >
};

const MUSTACHE_TEMPLATE_VARIABLE_NAMES = Object.freeze(
    Object.keys(createMustacheViewFromValues(EMPTY_MUSTACHE_VIEW_VALUES))
);

export function getMustacheTemplateVariableNames(): readonly string[] {
    return MUSTACHE_TEMPLATE_VARIABLE_NAMES;
}

export async function createMustacheView(date: Date = new Date()): Promise<MustacheTemplateView> {
    const now = dayjs(date);
    const additionalSystemMessage =
        LogseqSettingAccessor.getPluginSettings().globalAgentInstruction?.trim() ?? "";
    const currentPage = await LogseqEditor.getCurrentPage();
    const currentEditingBlock = await LogseqEditor.getCurrentEditingBlock();
    const dayjsFormat = await getUserPreferredDayjsFormat();
    const modelInvokableSkillList = await getModelInvokableSkillListString();

    return createMustacheViewFromValues({
        globalAgentInstruction: additionalSystemMessage,
        currentPage: currentPage?.uuid ?? "No current page",
        currentEditingBlock: currentEditingBlock?.uuid ?? "No current editing block",
        modelInvokableSkillList,
        chatAppAgentToolResultMaxChar: String(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR),
        time: now.format("HH:mm"),
        today: now.format(dayjsFormat),
        tomorrow: now.add(1, "day").format(dayjsFormat),
        yesterday: now.subtract(1, "day").format(dayjsFormat),
        userTimeZone: getUserTimeZone(),
        lastWeekdays: Object.fromEntries(
            WEEKDAYS.map(([weekday, weekdayIndex]) => [
                weekday,
                getLastWeekday(now, weekdayIndex).format(dayjsFormat)
            ])
        ) as MustacheViewValues["lastWeekdays"]
    });
}
