import {describe, expect, test} from "vitest";

import {ChatToolRegistry} from "../../../../src/chat-app/tools/ToolRegistry";

describe("ChatToolRegistry PDF tools", () => {
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

    test("keeps Jina web tools in the registry for request-time filtering", () => {
        const toolkit = ChatToolRegistry.build().getAUIToolkit();

        expect(toolkit.web_search).toBeDefined();
        expect(toolkit.web_page_get).toBeDefined();
    });
});
