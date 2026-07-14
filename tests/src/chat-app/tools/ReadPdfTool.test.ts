import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {ReadPdfTool} from "../../../../src/chat-app/tools/impl/ReadPdfTool";
import {UnstructuredParseStore} from "../../../../src/core/stores/unstructured-parse-store/UnstructuredParseStore";
import {UnstructuredApiError} from "../../../../src/core/unstructured-wrapper/UnstructuredWrapper";
import {LogseqSettingAccessor} from "../../../../src/logseq/LogseqSettingAccessor";
import {WindowParentBridge} from "../../../../src/logseq/WindowParentBridge";

const {splitPdfPagesMock, parsePagesMock, wrapperConstructorMock} = vi.hoisted(() => ({
    splitPdfPagesMock: vi.fn(),
    parsePagesMock: vi.fn(),
    wrapperConstructorMock: vi.fn()
}));

vi.mock("src/core/unstructured-wrapper/UnstructuredWrapper", () => {
    class MockUnstructuredApiError extends Error {
        constructor(
            readonly statusCode: number,
            message: string
        ) {
            super(message);
        }
    }

    return {
        UnstructuredApiError: MockUnstructuredApiError,
        UnstructuredWrapper: class {
            constructor(options: unknown) {
                wrapperConstructorMock(options);
            }

            splitPdfPages = splitPdfPagesMock;
            parsePages = parsePagesMock;
        }
    };
});

const preparedPages = [
    {
        pageNo: 1,
        fileName: "source-page-1.pdf",
        bytes: new Uint8Array([1]),
        hash: "hash-1"
    },
    {
        pageNo: 2,
        fileName: "source-page-2.pdf",
        bytes: new Uint8Array([2]),
        hash: "hash-2"
    }
];

describe("ReadPdfTool", () => {
    beforeEach(() => {
        splitPdfPagesMock.mockReset().mockResolvedValue(preparedPages);
        parsePagesMock.mockReset();
        wrapperConstructorMock.mockReset();
        vi.spyOn(LogseqSettingAccessor, "getPluginSettings").mockReturnValue({
            disabled: false,
            unstructuredApiKey: " api-key ",
            unstructuredApiUrl: " https://platform-api.transform.unstructured.io/api/v1 "
        });
        vi.spyOn(WindowParentBridge, "makeAssetUrl").mockResolvedValue("assets://source.pdf");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {status: 200}))
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test("serves full cache hits without calling the parsing API", async () => {
        vi.spyOn(UnstructuredParseStore, "get")
            .mockResolvedValueOnce({version: 1, elements: [], content: "Cached one"})
            .mockResolvedValueOnce({version: 1, elements: [], content: "Cached two"});
        vi.spyOn(UnstructuredParseStore, "save").mockResolvedValue(undefined);

        const response = await new ReadPdfTool().execute({
            pdfPath: "../assets/source.pdf",
            pageNo: [1, 2]
        });

        expect(response.result).toMatchObject({
            success: true,
            pages: [
                {pageNo: 1, content: "Cached one"},
                {pageNo: 2, content: "Cached two"}
            ]
        });
        expect(parsePagesMock).not.toHaveBeenCalled();
        expect(UnstructuredParseStore.save).not.toHaveBeenCalled();
    });

    test("batches only cache misses and stores successful results", async () => {
        vi.spyOn(UnstructuredParseStore, "get")
            .mockResolvedValueOnce({version: 1, elements: [], content: "Cached one"})
            .mockResolvedValueOnce(null);
        vi.spyOn(UnstructuredParseStore, "save").mockResolvedValue(undefined);
        parsePagesMock.mockResolvedValue([
            {pageNo: 2, elements: [{text: "Parsed two"}], content: "Parsed two"}
        ]);
        const abortSignal = new AbortController().signal;

        const response = await new ReadPdfTool().execute(
            {pdfPath: "../assets/source.pdf", pageNo: [1, 2]},
            {abortSignal}
        );

        expect(wrapperConstructorMock).toHaveBeenCalledWith({
            apiKey: "api-key",
            apiUrl: "https://platform-api.transform.unstructured.io/api/v1"
        });
        expect(splitPdfPagesMock).toHaveBeenCalledWith(expect.any(Uint8Array), 1, 2, "source.pdf");
        expect(parsePagesMock).toHaveBeenCalledWith([preparedPages[1]], abortSignal);
        expect(UnstructuredParseStore.save).toHaveBeenCalledWith("hash-2", {
            version: 1,
            elements: [{text: "Parsed two"}],
            content: "Parsed two"
        });
        expect(response.result).toMatchObject({
            success: true,
            pages: [
                {pageNo: 1, content: "Cached one"},
                {pageNo: 2, content: "Parsed two"}
            ]
        });
    });

    test("rejects ranges of eight pages before execution", () => {
        const result = new ReadPdfTool().parameters.safeParse({
            pdfPath: "../assets/source.pdf",
            pageNo: [1, 8]
        });

        expect(result.success).toBe(false);
    });

    test("returns a configuration error before fetching the PDF", async () => {
        vi.mocked(LogseqSettingAccessor.getPluginSettings).mockReturnValue({disabled: false});

        const response = await new ReadPdfTool().execute({
            pdfPath: "../assets/source.pdf",
            pageNo: [1, 1]
        });

        expect(response.isError).toBe(true);
        expect((response.result as {error: string}).error).toContain("API key is not configured");
        expect(WindowParentBridge.makeAssetUrl).not.toHaveBeenCalled();
    });

    test("returns a focused authentication error for API 401 responses", async () => {
        vi.spyOn(UnstructuredParseStore, "get").mockResolvedValue(null);
        parsePagesMock.mockRejectedValue(new UnstructuredApiError(401, "unauthorized"));

        const response = await new ReadPdfTool().execute({
            pdfPath: "../assets/source.pdf",
            pageNo: [1, 2]
        });

        expect(response.isError).toBe(true);
        expect((response.result as {error: string}).error).toContain(
            "rejected the configured API key"
        );
    });
});
