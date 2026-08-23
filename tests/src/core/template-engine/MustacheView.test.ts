import {afterEach, describe, expect, test, vi} from "vitest";
import {
    createMustacheView,
    createMustacheViewFromValues,
    getMustacheTemplateVariableNames
} from "../../../../src/core/template-engine";
import * as skillListModule from "../../../../src/core/template-engine/getModelInvokableSkillListString";
import * as dateFormatModule from "../../../../src/core/template-engine/getUserPreferredDayjsFormat";
import * as timeZoneModule from "../../../../src/core/template-engine/getUserTimeZone";
import {LogseqEditor} from "../../../../src/logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../../../src/logseq/LogseqSettingAccessor";

describe("MustacheView", () => {
    afterEach(() => vi.restoreAllMocks());

    test("exposes canonical variables and spaced aliases", async () => {
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
            disabled: false,
            globalAgentInstruction: "  Be precise  "
        });
        vi.spyOn(LogseqEditor, "getCurrentPage").mockResolvedValue({uuid: "page-uuid"} as never);
        vi.spyOn(LogseqEditor, "getCurrentEditingBlock").mockResolvedValue({
            uuid: "block-uuid"
        } as never);
        vi.spyOn(skillListModule, "getModelInvokableSkillListString").mockResolvedValue("skills");
        vi.spyOn(dateFormatModule, "getUserPreferredDayjsFormat").mockResolvedValue("YYYY-MM-DD");
        vi.spyOn(timeZoneModule, "getUserTimeZone").mockReturnValue("UTC");

        const view = await createMustacheView(new Date("2026-08-22T12:30:00"));

        expect(view.globalAgentInstruction).toBe("Be precise");
        expect(view.GLOBALAGENTINSTRUCTION).toBe("Be precise");
        expect(view.currentPage).toBe("page-uuid");
        expect(view["last saturday"]).toBe("2026-08-15");
    });

    test("derives supported variable names from the synchronous view shape", () => {
        const view = createMustacheViewFromValues({
            globalAgentInstruction: "instruction",
            currentPage: "page",
            currentEditingBlock: "block",
            modelInvokableSkillList: "skills",
            chatAppAgentToolResultMaxChar: "100",
            time: "12:00",
            today: "today",
            tomorrow: "tomorrow",
            yesterday: "yesterday",
            userTimeZone: "UTC",
            lastWeekdays: {
                Sunday: "Sunday",
                Monday: "Monday",
                Tuesday: "Tuesday",
                Wednesday: "Wednesday",
                Thursday: "Thursday",
                Friday: "Friday",
                Saturday: "Saturday"
            }
        });

        expect(getMustacheTemplateVariableNames()).toEqual(Object.keys(view));
        expect(getMustacheTemplateVariableNames()).toContain("globalAgentInstruction");
        expect(getMustacheTemplateVariableNames()).toContain("currentEditingBlock");
        expect(getMustacheTemplateVariableNames()).not.toContain("additionalSystemMessage");
        expect(getMustacheTemplateVariableNames()).not.toContain("lastMonday");
        expect(view["last sunday"]).toBe("Sunday");
    });
});
