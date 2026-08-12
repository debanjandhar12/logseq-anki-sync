import type {ThreadMessage} from "@assistant-ui/react";
import {beforeEach, describe, expect, test, vi} from "vitest";

const {completion, loadModel} = vi.hoisted(() => ({
    completion: vi.fn(),
    loadModel: vi.fn()
}));

vi.mock("@fugood/node-llama-wasm", () => ({loadModel}));
vi.mock("../../../../src/logger", () => ({
    createLogger: () => ({error: vi.fn()}),
    LoggerCategory: {MISC: "Misc"}
}));
vi.mock("../../../../src/core/title-generator/models/SupraTitle-50M-Q1_0.gguf?url", () => ({
    default: "/assets/SupraTitle-50M-Q1_0.gguf"
}));

import {generateTitle} from "../../../../src/core/title-generator/generateTitle";

const makeMessage = (role: ThreadMessage["role"], text: string): ThreadMessage =>
    ({
        id: `msg-${role}`,
        role,
        createdAt: new Date(),
        content: [{type: "text", text}],
        attachments: [],
        metadata: undefined as never
    }) as ThreadMessage;

describe("generateTitle", () => {
    const fallbackId = "thread-abc-123";

    beforeEach(() => {
        completion.mockReset();
        loadModel.mockReset();
        loadModel.mockResolvedValue({completion});
        completion.mockResolvedValue({text: "AI Working Explained"});
    });

    test("returns remoteId without initializing when no user text exists", async () => {
        await expect(generateTitle(fallbackId, [])).resolves.toBe(fallbackId);
        await expect(
            generateTitle(fallbackId, [makeMessage("assistant", "Response")])
        ).resolves.toBe(fallbackId);

        expect(loadModel).not.toHaveBeenCalled();
    });

    test("lazily initializes the bundled one-bit WASM model once", async () => {
        await expect(
            generateTitle(fallbackId, [makeMessage("user", "How does AI work?")])
        ).resolves.toBe("AI Working Explained");
        await expect(
            generateTitle(fallbackId, [makeMessage("user", "Why is the sky blue?")])
        ).resolves.toBe("AI Working Explained");

        expect(loadModel).toHaveBeenCalledTimes(1);
        expect(loadModel).toHaveBeenCalledWith({
            model: "/assets/SupraTitle-50M-Q1_0.gguf",
            n_ctx: 5120,
            n_threads: 1,
            n_gpu_layers: 0,
            wasm: {
                worker: false,
                threads: false,
                cacheDownloads: false
            }
        });
    });

    test("sends only the first user's complete text to the title model", async () => {
        const multipartUserMessage = {
            ...makeMessage("user", "How does AI work?"),
            content: [
                {type: "text" as const, text: "How does AI work?"},
                {type: "text" as const, text: "Explain it simply."}
            ]
        } as ThreadMessage;
        await generateTitle(fallbackId, [
            makeMessage("assistant", "Earlier assistant output"),
            multipartUserMessage,
            makeMessage("user", "Do not include this")
        ]);

        expect(completion).toHaveBeenCalledWith({
            prompt: "User: How does AI work?\n\nExplain it simply.\nTitle: ",
            n_predict: 24,
            temperature: 0.4,
            top_k: 40,
            top_p: 0.85,
            penalty_repeat: 1.2,
            stop: ["</s>"]
        });
    });

    test("falls back to remoteId when inference returns no title", async () => {
        completion.mockResolvedValueOnce({text: "   "});

        await expect(
            generateTitle(fallbackId, [makeMessage("user", "How does AI work?")])
        ).resolves.toBe(fallbackId);
    });

    test("falls back to remoteId when inference fails", async () => {
        completion.mockRejectedValueOnce(new Error("inference failed"));

        await expect(
            generateTitle(fallbackId, [makeMessage("user", "How does AI work?")])
        ).resolves.toBe(fallbackId);
    });
});
