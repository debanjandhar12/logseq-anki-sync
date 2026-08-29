import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {LogseqSettingAccessor} from "../../src/logseq/LogseqSettingAccessor";

const {showCommandEditorModalMock, showSkillEditorModalMock} = vi.hoisted(() => ({
    showCommandEditorModalMock: vi.fn<() => Promise<boolean | null>>(),
    showSkillEditorModalMock: vi.fn<() => Promise<boolean | null>>()
}));

vi.mock("../../src/ui/launchers/showCommandEditorModal", () => ({
    showCommandEditorModal: showCommandEditorModalMock
}));
vi.mock("../../src/ui/launchers/showSkillEditorModal", () => ({
    showSkillEditorModal: showSkillEditorModalMock
}));

import {addSettingsToLogseq} from "../../src/settings";

type SettingsButtonSchemaDesc = Omit<SettingSchemaDesc, "type"> & {
    type: "button";
    buttonText: string;
    buttonAction: string;
};

describe("addSettingsToLogseq", () => {
    const provideModelMock = vi.fn();
    let useSettingsSchemaSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        showCommandEditorModalMock.mockResolvedValue(null);
        showSkillEditorModalMock.mockResolvedValue(null);
        vi.stubGlobal("logseq", {
            baseInfo: {id: "test-plugin"},
            provideModel: provideModelMock,
            provideStyle: vi.fn()
        });
        useSettingsSchemaSpy = vi
            .spyOn(LogseqSettingAccessor, "useSettingsSchema")
            .mockImplementation(() => undefined);
        vi.spyOn(LogseqSettingAccessor, "registerSettingsChangeListener").mockImplementation(
            () => () => undefined
        );
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({disabled: false});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        provideModelMock.mockReset();
        showCommandEditorModalMock.mockReset();
        showSkillEditorModalMock.mockReset();
    });

    test("registers the Skill Editor action and settings button", async () => {
        await addSettingsToLogseq();

        expect(provideModelMock.mock.invocationCallOrder[0]).toBeLessThan(
            useSettingsSchemaSpy.mock.invocationCallOrder[0]
        );

        const model = provideModelMock.mock.calls[0][0];
        const settingsSchema = useSettingsSchemaSpy.mock.calls[0][0] as Array<
            SettingSchemaDesc | SettingsButtonSchemaDesc
        >;
        const mainHeadingIndex = settingsSchema.findIndex(
            (setting) => setting.key === "mainSettingsHeading"
        );
        const commandEditorButton = settingsSchema.find(
            (setting) => setting.key === "openCommandEditorButton"
        ) as SettingsButtonSchemaDesc;
        const skillEditorButton = settingsSchema.find(
            (setting) => setting.key === "openSkillEditorButton"
        ) as SettingsButtonSchemaDesc;

        expect(settingsSchema[mainHeadingIndex]).toMatchObject({
            title: "💬 Main",
            type: "heading",
            default: null
        });
        expect(skillEditorButton).toMatchObject({
            key: "openSkillEditorButton",
            type: "button",
            default: null,
            title: "Skill Editor",
            buttonText: "Open Skill Editor",
            buttonAction: "openSkillEditorFromSettings"
        });
        expect(commandEditorButton).toMatchObject({
            key: "openCommandEditorButton",
            type: "button",
            default: null,
            title: "Command Editor",
            buttonText: "Open Command Editor",
            buttonAction: "openCommandEditorFromSettings"
        });
        const globalInstructionIndex = settingsSchema.findIndex(
            (setting) => setting.key === "globalAgentInstruction"
        );
        expect(
            Math.abs(
                settingsSchema.indexOf(skillEditorButton) -
                    settingsSchema.indexOf(commandEditorButton)
            )
        ).toBe(1);
        expect(globalInstructionIndex).toBeGreaterThan(settingsSchema.indexOf(skillEditorButton));
        expect(settingsSchema[globalInstructionIndex + 1].key).toBe("webToolsHeading");

        expect(model).toHaveProperty("openSkillEditorFromSettings");
        expect(model.openSkillEditorFromSettings()).toBeUndefined();
        expect(showSkillEditorModalMock).toHaveBeenCalledOnce();
        expect(model).toHaveProperty("openCommandEditorFromSettings");
        expect(model.openCommandEditorFromSettings()).toBeUndefined();
        expect(showCommandEditorModalMock).toHaveBeenCalledOnce();
    });

    test("consumes a rejected Skill Editor launch", async () => {
        showSkillEditorModalMock.mockRejectedValue(new Error("Failed to open"));
        await addSettingsToLogseq();

        const model = provideModelMock.mock.calls[0][0];
        expect(model.openSkillEditorFromSettings()).toBeUndefined();
        await Promise.resolve();

        expect(showSkillEditorModalMock).toHaveBeenCalledOnce();
    });

    test("consumes a rejected Command Editor launch", async () => {
        showCommandEditorModalMock.mockRejectedValue(new Error("Failed to open"));
        await addSettingsToLogseq();

        const model = provideModelMock.mock.calls[0][0];
        expect(model.openCommandEditorFromSettings()).toBeUndefined();
        await Promise.resolve();

        expect(showCommandEditorModalMock).toHaveBeenCalledOnce();
    });
});
