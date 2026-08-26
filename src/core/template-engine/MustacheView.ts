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

export type MustacheTemplateView = Record<string, string>;

export class MustacheView {
    private static variableNamesPromise: Promise<readonly string[]> | null = null;

    static async create(date: Date = new Date()): Promise<MustacheTemplateView> {
        const now = dayjs(date);
        const currentPage = await LogseqEditor.getCurrentPage();
        const currentEditingBlock = await LogseqEditor.getCurrentEditingBlock();
        const dayjsFormat = await getUserPreferredDayjsFormat();
        const modelInvokableSkillList = await getModelInvokableSkillListString();
        const view: MustacheTemplateView = {
            globalAgentInstruction:
                LogseqSettingAccessor.getPluginSettings().globalAgentInstruction?.trim() ?? "",
            currentPage: currentPage?.uuid ?? "No current page",
            currentEditingBlock: currentEditingBlock?.uuid ?? "No current editing block",
            modelInvokableSkillList,
            chatAppAgentToolResultMaxChar: String(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR),
            time: now.format("HH:mm"),
            today: now.format(dayjsFormat),
            tomorrow: now.add(1, "day").format(dayjsFormat),
            yesterday: now.subtract(1, "day").format(dayjsFormat),
            userTimeZone: getUserTimeZone()
        };

        for (const [weekday, weekdayIndex] of WEEKDAYS) {
            view[`last ${weekday.toLowerCase()}`] = MustacheView.getLastWeekday(
                now,
                weekdayIndex
            ).format(dayjsFormat);
        }

        return MustacheView.createCaseInsensitive(view);
    }

    static async getVariableNames(): Promise<readonly string[]> {
        if (!MustacheView.variableNamesPromise) {
            const variableNamesPromise = MustacheView.create().then((view) =>
                Object.freeze(Object.keys(view))
            );
            MustacheView.variableNamesPromise = variableNamesPromise;
            variableNamesPromise.catch(() => {
                if (MustacheView.variableNamesPromise === variableNamesPromise) {
                    MustacheView.variableNamesPromise = null;
                }
            });
        }

        return MustacheView.variableNamesPromise;
    }

    static createCaseInsensitive(view: MustacheTemplateView): MustacheTemplateView {
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

    private static getLastWeekday(date: dayjs.Dayjs, weekdayIndex: number): dayjs.Dayjs {
        const daysSinceWeekday = (date.day() - weekdayIndex + 7) % 7 || 7;
        return date.subtract(daysSinceWeekday, "day");
    }
}
