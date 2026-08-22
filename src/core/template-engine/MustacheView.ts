import dayjs from "dayjs";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR} from "../../constants";
import {LogseqEditor} from "../../logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {getModelInvokableSkillListString} from "./getModelInvokableSkillListString";
import {getUserPreferredDayjsFormat} from "./getUserPreferredDayjsFormat";
import {getUserTimeZone} from "./getUserTimeZone";
import {
    MUSTACHE_TEMPLATE_VARIABLES,
    setMustacheTemplateVariable
} from "./mustacheTemplateVariables";

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

    const view: MustacheTemplateView = {};
    setMustacheTemplateVariable(view, "globalAgentInstruction", additionalSystemMessage);
    setMustacheTemplateVariable(view, "currentPage", currentPage?.uuid ?? "No current page");
    setMustacheTemplateVariable(
        view,
        "currentEditingBlock",
        currentEditingBlock?.uuid ?? "No current editing block"
    );
    setMustacheTemplateVariable(view, "modelInvokableSkillList", modelInvokableSkillList);
    setMustacheTemplateVariable(
        view,
        "chatAppAgentToolResultMaxChar",
        String(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR)
    );
    setMustacheTemplateVariable(view, "time", now.format("HH:mm"));
    setMustacheTemplateVariable(view, "today", now.format(dayjsFormat));
    setMustacheTemplateVariable(view, "tomorrow", now.add(1, "day").format(dayjsFormat));
    setMustacheTemplateVariable(view, "userTimeZone", getUserTimeZone());
    setMustacheTemplateVariable(view, "yesterday", now.subtract(1, "day").format(dayjsFormat));

    for (const definition of MUSTACHE_TEMPLATE_VARIABLES) {
        if (definition.weekdayIndex == null) continue;
        setMustacheTemplateVariable(
            view,
            definition.canonicalName,
            getLastWeekday(now, definition.weekdayIndex).format(dayjsFormat)
        );
    }

    return createCaseInsensitiveMustacheView(view);
}
