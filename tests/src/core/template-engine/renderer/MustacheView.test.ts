import {afterEach, describe, expect, test, vi} from "vitest";
import {MustacheView} from "../../../../../src/core/template-engine";
import {LogseqEditor} from "../../../../../src/logseq/LogseqEditor";
import {LogseqSettingAccessor} from "../../../../../src/logseq/LogseqSettingAccessor";

const mocks = vi.hoisted(() => ({
    getModelInvokableSkillListString: vi.fn(),
    getUserPreferredDayjsFormat: vi.fn(),
    getUserTimeZone: vi.fn()
}));

vi.mock(
    "../../../../../src/core/template-engine/renderer/getModelInvokableSkillListString",
    () => ({
        getModelInvokableSkillListString: mocks.getModelInvokableSkillListString
    })
);
vi.mock("../../../../../src/core/template-engine/renderer/getUserPreferredDayjsFormat", () => ({
    getUserPreferredDayjsFormat: mocks.getUserPreferredDayjsFormat
}));
vi.mock("../../../../../src/core/template-engine/renderer/getUserTimeZone", () => ({
    getUserTimeZone: mocks.getUserTimeZone
}));

function mockMustacheViewDependencies() {
    vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
        disabled: false,
        globalAgentInstruction: "  Be precise  "
    });
    vi.spyOn(LogseqEditor, "getCurrentPage").mockResolvedValue({uuid: "page-uuid"} as never);
    vi.spyOn(LogseqEditor, "getCurrentEditingBlock").mockResolvedValue({
        uuid: "block-uuid"
    } as never);
    mocks.getModelInvokableSkillListString.mockResolvedValue("skills");
    mocks.getUserPreferredDayjsFormat.mockResolvedValue("YYYY-MM-DD");
    mocks.getUserTimeZone.mockReturnValue("UTC");
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
