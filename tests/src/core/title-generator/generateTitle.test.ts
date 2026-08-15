import type {ThreadMessage} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {generateTitle} from "../../../../src/core/title-generator/generateTitle";
import {normalizeGeneratedTitle} from "../../../../src/core/title-generator/normalizeGeneratedTitle";

const mocks = vi.hoisted(() => ({
    generateText: vi.fn(),
    getLLMModel: vi.fn(),
    getPluginSettings: vi.fn(),
    warn: vi.fn()
}));

vi.mock("ai", async (importOriginal) => ({
    ...(await importOriginal<typeof import("ai")>()),
    generateText: mocks.generateText
}));

vi.mock("../../../../src/core/ai-sdk/getLLMModel", () => ({getLLMModel: mocks.getLLMModel}));
vi.mock("../../../../src/logseq/LogseqSettingAccessor", () => ({
    LogseqSettingAccessor: {getPluginSettings: mocks.getPluginSettings}
}));
vi.mock("../../../../src/logger", () => ({
    LoggerCategory: {CHAT_UI: "Chat UI"},
    createLogger: () => ({warn: mocks.warn})
}));

const FALLBACK = "New Chat (thread-abc-123)";
const TITLE_INSTRUCTION =
    "Generate a concise title for the preceding user message. Return only the title, with no label, quotes, markdown, explanation, or trailing punctuation. Keep it at most 50 characters.";
const message = (role: "user" | "assistant", content: ThreadMessage["content"]): ThreadMessage =>
    ({
        id: `${role}-message`,
        role,
        createdAt: new Date(),
        content,
        attachments: [],
        metadata: undefined as never
    }) as ThreadMessage;

describe("generateTitle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getPluginSettings.mockReturnValue({selectedModelId: " current-model "});
        mocks.getLLMModel.mockResolvedValue({modelId: "current-model"});
        mocks.generateText.mockResolvedValue({text: "Generated title"});
    });

    test.each([
        ["no messages", []],
        ["no user message", [message("assistant", [{type: "text", text: "Response"}])]],
        ["first user message without text", [message("user", [])]],
        ["blank user text", [message("user", [{type: "text", text: "  "}])]]
    ])("returns the exact fallback for %s", async (_case, messages) => {
        await expect(generateTitle("thread-abc-123", messages)).resolves.toBe(FALLBACK);
        expect(mocks.generateText).not.toHaveBeenCalled();
        expect(mocks.warn).not.toHaveBeenCalled();
    });

    test("uses only all text parts from the first user message", async () => {
        const messages = [
            message("assistant", [{type: "text", text: "Leading response"}]),
            message("user", [
                {type: "text", text: " First part "},
                {type: "text", text: "Second part"}
            ]),
            message("user", [{type: "text", text: "Ignored later message"}])
        ];

        await expect(generateTitle("thread-abc-123", messages)).resolves.toBe("Generated title");

        expect(mocks.getLLMModel).toHaveBeenCalledWith("current-model");
        expect(mocks.generateText).toHaveBeenCalledWith({
            model: {modelId: "current-model"},
            messages: [
                {role: "user", content: "First part\nSecond part"},
                {role: "user", content: TITLE_INSTRUCTION}
            ]
        });
    });

    test("does not use a later user message when the first has no text", async () => {
        const messages = [
            message("user", []),
            message("user", [{type: "text", text: "Do not use this"}])
        ];

        await expect(generateTitle("thread-abc-123", messages)).resolves.toBe(FALLBACK);
        expect(mocks.generateText).not.toHaveBeenCalled();
    });

    test.each([undefined, "  "])("falls back when selectedModelId is %s", async (modelId) => {
        mocks.getPluginSettings.mockReturnValue({selectedModelId: modelId});

        await expect(
            generateTitle("thread-abc-123", [message("user", [{type: "text", text: "Question"}])])
        ).resolves.toBe(FALLBACK);
        expect(mocks.getLLMModel).not.toHaveBeenCalled();
    });

    test("rereads the persisted model on each call", async () => {
        const messages = [message("user", [{type: "text", text: "Question"}])];
        await generateTitle("thread-abc-123", messages);
        mocks.getPluginSettings.mockReturnValue({selectedModelId: "new-model"});
        await generateTitle("thread-abc-123", messages);

        expect(mocks.getLLMModel).toHaveBeenNthCalledWith(1, "current-model");
        expect(mocks.getLLMModel).toHaveBeenNthCalledWith(2, "new-model");
    });

    test.each([
        "model resolution",
        "text generation"
    ])("falls back and logs safely on %s failure", async (failurePoint) => {
        const error = new Error("provider failed");
        if (failurePoint === "model resolution") mocks.getLLMModel.mockRejectedValue(error);
        else mocks.generateText.mockRejectedValue(error);

        await expect(
            generateTitle("thread-abc-123", [
                message("user", [{type: "text", text: "Private user text"}])
            ])
        ).resolves.toBe(FALLBACK);
        expect(mocks.warn).toHaveBeenCalledWith(
            "Failed to generate AI thread title; using fallback",
            {remoteId: "thread-abc-123", error}
        );
        expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("Private user text");
    });

    test("falls back when normalized output is unusable", async () => {
        mocks.generateText.mockResolvedValue({text: "..."});

        await expect(
            generateTitle("thread-abc-123", [message("user", [{type: "text", text: "Question"}])])
        ).resolves.toBe(FALLBACK);
        expect(mocks.warn).toHaveBeenCalledWith(
            "AI thread title output was unusable; using fallback",
            {remoteId: "thread-abc-123"}
        );
    });
});

describe("normalizeGeneratedTitle", () => {
    test.each([
        ["Title: Example title.", "Example title"],
        ["Chat Title — **Example title!**", "Example title"],
        ['"Thread title: Example title?"', "Example title"],
        ["```text\nExample title.\n```", "Example title"],
        ["# Example\n title", "Example title"],
        ["- Example title;", "Example title"]
    ])("normalizes %j", (output, expected) => {
        expect(normalizeGeneratedTitle(output)).toBe(expected);
    });

    test("truncates at a word boundary to at most 50 code points", () => {
        const title = normalizeGeneratedTitle(
            "A deliberately verbose generated title that should be shortened before persistence"
        );

        expect(Array.from(title ?? "").length).toBeLessThanOrEqual(50);
        expect(title).toBe("A deliberately verbose generated title that");
    });

    test("does not split a Unicode surrogate pair", () => {
        const title = normalizeGeneratedTitle("x".repeat(49) + "😀more");
        expect(Array.from(title ?? "")).toHaveLength(50);
        expect(title?.endsWith("😀")).toBe(true);
    });
});
