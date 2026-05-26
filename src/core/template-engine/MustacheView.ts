import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import {LogseqEditor} from "../../logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import getNameFromPage from "../../logseq/utils/getNameFromPage";

dayjs.extend(advancedFormat);

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
} as const;

function formatDate(date: dayjs.Dayjs): string {
    return date.format("MMMM Do, YYYY");
}

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
    const currentPageName = currentPage ? (getNameFromPage(currentPage) ?? "") : "";

    const view: MustacheTemplateView = {
        "additional system message": additionalSystemMessage,
        "current page": currentPageName,
        additionalsystemmessage: additionalSystemMessage,
        additionalSystemMessage,
        currentpage: currentPageName,
        currentPage: currentPageName,
        time: now.format("HH:mm"),
        today: formatDate(now),
        tomorrow: formatDate(now.add(1, "day")),
        yesterday: formatDate(now.subtract(1, "day"))
    };

    for (const [weekdayName, weekdayIndex] of Object.entries(WEEKDAY_INDEX_BY_NAME)) {
        view[`last ${weekdayName}`] = formatDate(getLastWeekday(now, weekdayIndex));
    }

    return createCaseInsensitiveMustacheView(view);
}
