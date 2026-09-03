import {ProviderTypeEnum} from "./types";

const NATIVE_WEB_TOOL_PROVIDERS = new Set<ProviderTypeEnum>([
    ProviderTypeEnum.OPENAI,
    ProviderTypeEnum.GOOGLE,
    ProviderTypeEnum.CODEX_SUBSCRIPTION
]);

export function hasNativeWebTools(providerType: ProviderTypeEnum): boolean {
    return NATIVE_WEB_TOOL_PROVIDERS.has(providerType);
}
