import {beforeEach, describe, expect, test, vi} from "vitest";

const settingsMocks = vi.hoisted(() => ({getPluginSettings: vi.fn()}));

vi.mock("../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: settingsMocks
}));

import {ChatToolRegistry} from "../../../../src/chat-app/tools/ToolRegistry";

describe("ChatToolRegistry PDF tools", () => {
    beforeEach(() => {
        settingsMocks.getPluginSettings.mockReturnValue({
            contentParsingProvider: "Disable Content Parsing"
        });
    });

    test("always registers parse_pdf and removes read_pdf", () => {
        const toolkit = ChatToolRegistry.build().getAUIToolkit();

        expect(toolkit.parse_pdf).toBeDefined();
        expect(toolkit.read_pdf).toBeUndefined();
    });
});
