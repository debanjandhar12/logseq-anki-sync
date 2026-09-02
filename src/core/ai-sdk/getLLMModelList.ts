import {readProviderConfigs} from "./provider-config/readProviderConfigs";
import {formatSelectedModelId} from "./provider-config/selectedModelId";

export interface LLMModelOption {
    id: string;
    name: string;
    description?: string;
    providerConfigUuid: string;
    providerConfigName: string;
    efforts?: boolean;
}

export function getLLMModelList(): LLMModelOption[] {
    return readProviderConfigs().flatMap((config) =>
        config.models
            .filter((model) => model.enabled)
            .map((model) => ({
                id: formatSelectedModelId(config.uuid, model.id),
                name: model.id,
                providerConfigUuid: config.uuid,
                providerConfigName: config.name,
                efforts: true
            }))
    );
}
