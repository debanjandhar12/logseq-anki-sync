import type {ProviderConfig} from "../types";

export const SELECTED_MODEL_ID_DELIMITER = "////";

export interface ParsedSelectedModelId {
    configId: string;
    modelId: string;
}

export function formatSelectedModelId(configId: string, modelId: string): string {
    if (!configId || configId.includes(SELECTED_MODEL_ID_DELIMITER)) {
        throw new Error("Provider configuration ID is invalid");
    }
    if (!modelId) throw new Error("Model ID is required");
    return `${configId}${SELECTED_MODEL_ID_DELIMITER}${modelId}`;
}

export function parseSelectedModelId(selection: string): ParsedSelectedModelId {
    const delimiterIndex = selection.indexOf(SELECTED_MODEL_ID_DELIMITER);
    if (delimiterIndex <= 0) throw new Error("Selected model is invalid");

    const configId = selection.slice(0, delimiterIndex);
    const modelId = selection.slice(delimiterIndex + SELECTED_MODEL_ID_DELIMITER.length);
    if (!modelId) throw new Error("Selected model is invalid");
    return {configId, modelId};
}

export function reconcileSelectedModelId(
    previousSelection: string | undefined,
    nextConfigs: ProviderConfig[],
    renamedIds: Map<string, string> = new Map()
): string {
    if (previousSelection) {
        try {
            const parsed = parseSelectedModelId(previousSelection);
            const configId = renamedIds.get(parsed.configId) ?? parsed.configId;
            const config = nextConfigs.find((candidate) => candidate.id === configId);
            if (config?.models.some((model) => model.id === parsed.modelId && model.enabled)) {
                return formatSelectedModelId(configId, parsed.modelId);
            }
        } catch {
            // Fall back to the first enabled model below.
        }
    }

    for (const config of nextConfigs) {
        const model = config.models.find((candidate) => candidate.enabled);
        if (model) return formatSelectedModelId(config.id, model.id);
    }
    return "";
}
