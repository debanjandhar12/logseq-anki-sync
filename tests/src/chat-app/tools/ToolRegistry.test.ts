import {describe, expect, test} from "vitest";

import {ChatToolRegistry} from "../../../../src/chat-app/tools/ToolRegistry";

describe("ChatToolRegistry document tools", () => {
    test("registers parse_document without legacy PDF tools", () => {
        const toolkit = ChatToolRegistry.build().getAUIToolkit();

        expect(toolkit.parse_document).toBeDefined();
        expect(toolkit.parse_pdf).toBeUndefined();
        expect(toolkit.read_pdf).toBeUndefined();
    });

    test("keeps Jina web tools in the registry for request-time filtering", () => {
        const toolkit = ChatToolRegistry.build().getAUIToolkit();

        expect(toolkit.web_search).toBeDefined();
        expect(toolkit.web_page_get).toBeDefined();
    });
});
