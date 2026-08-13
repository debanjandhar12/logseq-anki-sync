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

    test("exposes human and standalone metadata from the same registry", () => {
        const registry = ChatToolRegistry.build();
        const toolkit = registry.getAUIToolkit();

        expect(toolkit.logseq_commit_changes).toMatchObject({
            type: "human",
            display: "standalone"
        });
        expect(registry.getHumanToolNames()).toContain("logseq_commit_changes");
    });
});
