import {afterEach, describe, expect, test, vi} from "vitest";
import {WebPageGetTool} from "../../../../../src/chat-app/tools/impl/WebPageGetTool";
import {WebSearchTool} from "../../../../../src/chat-app/tools/impl/WebSearchTool";
import {LogseqSettingAccessor} from "../../../../../src/logseq/LogseqSettingAccessor";

describe("Jina web tools", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test.each([undefined, "", "   "])("rejects an unusable API key %s", async (jinaApiKey) => {
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
            disabled: false,
            jinaApiKey
        });
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const searchResponse = await new WebSearchTool().execute({query: "latest news"});
        const pageResponse = await new WebPageGetTool().execute({url: "https://example.com"});

        expect(searchResponse.result).toMatchObject({success: false});
        expect(pageResponse.result).toMatchObject({success: false});
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("trims the API key before making Jina requests", async () => {
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
            disabled: false,
            jinaApiKey: "  secret  "
        });
        const fetchMock = vi.fn(async () => new Response("content", {status: 200}));
        vi.stubGlobal("fetch", fetchMock);

        const searchResponse = await new WebSearchTool().execute({query: " latest news "});
        const pageResponse = await new WebPageGetTool().execute({url: "https://example.com"});

        expect(searchResponse.result).toEqual({
            success: true,
            query: " latest news ",
            content: "content"
        });
        expect(pageResponse.result).toEqual({
            success: true,
            url: "https://example.com",
            content: "content"
        });
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "https://s.jina.ai/?q=latest%20news",
            expect.objectContaining({headers: {Authorization: "Bearer secret"}})
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://r.jina.ai/https://example.com",
            expect.objectContaining({headers: {Authorization: "Bearer secret"}})
        );
    });
});
