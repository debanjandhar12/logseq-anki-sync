import type {SettingSchemaDesc} from "@logseq/libs/dist/LSPlugin";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {encodeProviderConfigs} from "../../src/core/ai-sdk/provider-config/providerConfigCodec";
import {LogseqSettingAccessor} from "../../src/logseq/LogseqSettingAccessor";

const {showCommandEditorModalMock, showProviderConfigModalMock, showSkillEditorModalMock} =
    vi.hoisted(() => ({
        showCommandEditorModalMock: vi.fn<() => Promise<boolean | null>>(),
        showProviderConfigModalMock: vi.fn<() => Promise<boolean | null>>(),
        showSkillEditorModalMock: vi.fn<() => Promise<boolean | null>>()
    }));

vi.mock("../../src/ui/launchers/showCommandEditorModal", () => ({
    showCommandEditorModal: showCommandEditorModalMock
}));
vi.mock("../../src/ui/launchers/showSkillEditorModal", () => ({
    showSkillEditorModal: showSkillEditorModalMock
}));
vi.mock("../../src/ui/launchers/showProviderConfigModal", () => ({
    showProviderConfigModal: showProviderConfigModalMock
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
        showProviderConfigModalMock.mockResolvedValue(null);
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
        showProviderConfigModalMock.mockReset();
        showSkillEditorModalMock.mockReset();
    });

    test("registers editor actions and settings buttons before the schema", async () => {
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
        const llmHeadingIndex = settingsSchema.findIndex(
            (setting) => setting.key === "llmSettingsHeading"
        );
        const providerConfigButton = settingsSchema.find(
            (setting) => setting.key === "openProviderConfigButton"
        ) as SettingsButtonSchemaDesc;
        const providerConfigSetting = settingsSchema.find(
            (setting) => setting.key === "providerConfigSetting"
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
        expect(providerConfigButton).toMatchObject({
            key: "openProviderConfigButton",
            type: "button",
            default: null,
            title: "Provider Configurations",
            buttonText: "Open Provider Configurations",
            buttonAction: "openProviderConfigFromSettings"
        });
        expect(settingsSchema[llmHeadingIndex + 1]).toBe(providerConfigButton);
        expect(settingsSchema[llmHeadingIndex + 2]).toBe(providerConfigSetting);
        expect(providerConfigSetting).toMatchObject({
            key: "providerConfigSetting",
            type: "string",
            default: encodeProviderConfigs([])
        });
        expect(settingsSchema.map((setting) => setting.key)).not.toEqual(
            expect.arrayContaining(["llmProvider", "llmAPIUrl", "llmAPIKey", "llmAPIModelList"])
        );
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
        expect(model).toHaveProperty("openProviderConfigFromSettings");
        expect(model.openProviderConfigFromSettings()).toBeUndefined();
        expect(showProviderConfigModalMock).toHaveBeenCalledOnce();

        const staticStyle = vi.mocked(logseq.provideStyle).mock.calls[0][0];
        expect(staticStyle).toContain('[data-id="test-plugin"]');
        expect(staticStyle).toContain('[data-key="providerConfigSetting"]');
        expect(staticStyle).toContain("display: none");
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

    test("consumes a rejected Provider Configurations launch", async () => {
        showProviderConfigModalMock.mockRejectedValue(new Error("Failed to open"));
        await addSettingsToLogseq();

        const model = provideModelMock.mock.calls[0][0];
        expect(model.openProviderConfigFromSettings()).toBeUndefined();
        await Promise.resolve();

        expect(showProviderConfigModalMock).toHaveBeenCalledOnce();
    });
});
