import {generateText} from "ai";
import {createLLMModel} from "../getLLMModel";
import type {ProviderConfig} from "../types";
import {validateProviderConnection} from "./validateProviderConfig";

export async function testProviderConfig(config: ProviderConfig): Promise<void> {
    validateProviderConnection(config);
    const model = config.models.find((candidate) => candidate.enabled && candidate.id.trim());
    if (!model) throw new Error("At least one enabled model is required");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        await generateText({
            model: createLLMModel({config, rawModelId: model.id.trim()}),
            prompt: "Reply with OK.",
            maxOutputTokens: 8,
            abortSignal: controller.signal
        });
    } catch {
        if (controller.signal.aborted) throw new Error("Provider connection test timed out");
        throw new Error("Provider connection test failed");
    } finally {
        clearTimeout(timeout);
    }
}
