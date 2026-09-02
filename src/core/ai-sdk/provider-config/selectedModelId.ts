import {validate as isUuid} from "uuid";
import type {ProviderConfig} from "../types";

export const SELECTED_MODEL_ID_DELIMITER = "////";

export interface ParsedSelectedModelId {
    providerUuid: string;
    modelId: string;
}

export function formatSelectedModelId(providerUuid: string, modelId: string): string {
    if (!isUuid(providerUuid)) {
        throw new Error("Provider configuration UUID is invalid");
    }
    if (!modelId) throw new Error("Model ID is required");
    return `${providerUuid}${SELECTED_MODEL_ID_DELIMITER}${modelId}`;
}

export function parseSelectedModelId(selection: string): ParsedSelectedModelId {
    const delimiterIndex = selection.indexOf(SELECTED_MODEL_ID_DELIMITER);
    if (delimiterIndex <= 0) throw new Error("Selected model is invalid");

    const providerUuid = selection.slice(0, delimiterIndex);
    const modelId = selection.slice(delimiterIndex + SELECTED_MODEL_ID_DELIMITER.length);
    if (!isUuid(providerUuid) || !modelId) throw new Error("Selected model is invalid");
    return {providerUuid, modelId};
}

export function reconcileSelectedModelId(
    previousSelection: string | undefined,
    nextConfigs: ProviderConfig[]
): string {
    if (previousSelection) {
        try {
            const parsed = parseSelectedModelId(previousSelection);
            const config = nextConfigs.find((candidate) => candidate.uuid === parsed.providerUuid);
            if (config?.models.some((model) => model.id === parsed.modelId && model.enabled)) {
                return formatSelectedModelId(config.uuid, parsed.modelId);
            }
        } catch {
            // Fall back to the first enabled model below.
        }
    }

    for (const config of nextConfigs) {
        const model = config.models.find((candidate) => candidate.enabled);
        if (model) return formatSelectedModelId(config.uuid, model.id);
    }
    return "";
}
