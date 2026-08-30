import {generateText} from "ai";
import {CodexSessionManager} from "../codex/CodexSessionManager";
import {createLLMModel} from "../getLLMModel";
import {type ProviderConfig, ProviderTypeEnum} from "../types";
import {validateProviderConnection} from "./validateProviderConfig";

export async function testProviderConfig(
    config: ProviderConfig,
    onCodexCredentialsUpdated?: (encodedCredentials: string) => void
): Promise<void> {
    validateProviderConnection(config);
    const model = config.models.find((candidate) => candidate.enabled && candidate.id.trim());
    if (!model) throw new Error("At least one enabled model is required");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const languageModel =
            config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION
                ? CodexSessionManager.getConfigSession(
                      config,
                      onCodexCredentialsUpdated
                  ).aiProvider.responses(model.id.trim())
                : createLLMModel({config, rawModelId: model.id.trim()});
        await generateText({
            model: languageModel,
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
