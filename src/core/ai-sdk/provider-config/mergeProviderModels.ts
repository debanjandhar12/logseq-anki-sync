import type {ProviderModelConfig} from "../types";

export function mergeProviderModels(
    existingModels: ProviderModelConfig[],
    fetchedModelIds: string[]
): ProviderModelConfig[] {
    const knownIds = new Set(existingModels.map((model) => model.id));
    const merged = existingModels.map((model) => ({...model}));
    for (const id of fetchedModelIds) {
        if (knownIds.has(id)) continue;
        knownIds.add(id);
        merged.push({id, enabled: false});
    }
    return merged;
}
