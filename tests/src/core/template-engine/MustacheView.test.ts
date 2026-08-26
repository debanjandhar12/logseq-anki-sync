import {afterEach, describe, expect, test, vi} from "vitest";
import {MustacheView} from "../../../../src/core/template-engine";
import * as skillListModule from "../../../../src/core/template-engine/getModelInvokableSkillListString";
import * as dateFormatModule from "../../../../src/core/template-engine/getUserPreferredDayjsFormat";
import * as timeZoneModule from "../../../../src/core/template-engine/getUserTimeZone";
import {LogseqEditor} from "../../../../src/logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../../../src/logseq/LogseqSettingAccessor";

function mockMustacheViewDependencies() {
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
}

describe("MustacheView", () => {
    afterEach(() => vi.restoreAllMocks());

    test("exposes canonical variables and spaced aliases", async () => {
        mockMustacheViewDependencies();

        const view = await MustacheView.create(new Date("2026-08-22T12:30:00"));

        expect(view.globalAgentInstruction).toBe("Be precise");
        expect(view.GLOBALAGENTINSTRUCTION).toBe("Be precise");
        expect(view.currentPage).toBe("page-uuid");
        expect(view["last saturday"]).toBe("2026-08-15");
    });

    test("derives supported variable names from the created view", async () => {
        mockMustacheViewDependencies();

        const [variableNames, view] = await Promise.all([
            MustacheView.getVariableNames(),
            MustacheView.create(new Date("2026-08-22T12:30:00"))
        ]);

        expect(variableNames).toEqual(Object.keys(view));
        expect(variableNames).toContain("globalAgentInstruction");
        expect(variableNames).toContain("currentEditingBlock");
        expect(variableNames).not.toContain("additionalSystemMessage");
        expect(variableNames).not.toContain("lastMonday");
    });

    test("creates case-insensitive views for caller-supplied values", () => {
        const view = MustacheView.createCaseInsensitive({today: "today"});

        expect(view.TODAY).toBe("today");
    });
});
