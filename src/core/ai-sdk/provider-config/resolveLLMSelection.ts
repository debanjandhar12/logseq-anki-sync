import type {ProviderConfig} from "../types";
import {parseSelectedModelId} from "./selectedModelId";
import {validateProviderConnection} from "./validateProviderConfig";

export interface ResolvedLLMSelection {
    config: ProviderConfig;
    rawModelId: string;
}

export function resolveLLMSelection(
    selection: string,
    configs: ProviderConfig[]
): ResolvedLLMSelection {
    const {providerUuid, modelId} = parseSelectedModelId(selection);
    const config = configs.find((candidate) => candidate.uuid === providerUuid);
    if (!config) throw new Error("Selected provider configuration was not found");

    const model = config.models.find((candidate) => candidate.id === modelId);
    if (!model?.enabled) throw new Error("Selected model is not enabled");
    validateProviderConnection(config);
    return {config, rawModelId: model.id};
}
