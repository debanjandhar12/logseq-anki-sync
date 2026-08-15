import {providers} from "@opencode-ai/models/snapshot";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {PROVIDER_SNAPSHOT_KEY} from "./constants";
import {ProviderEnum} from "./types";

export interface LLMModelOption {
    id: string;
    name: string;
    description?: string;
    efforts?: boolean;
}

export function getLLMModelList(): LLMModelOption[] {
    const settings = LogseqSettingAccessor.getPluginSettings();
    const provider = settings.llmProvider;

    if (provider === ProviderEnum.OPENAI_COMPATIBLE) {
        const raw = settings.llmAPIModelList ?? "";
        return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((id) => ({id, name: id, efforts: true}));
    }

    const snapshotKey = provider ? PROVIDER_SNAPSHOT_KEY[provider] : undefined;
    if (!snapshotKey) return [];

    const providerData = providers[snapshotKey];
    if (!providerData) return [];

    return Object.values(providerData.models)
        .filter((m) => m.modalities?.input?.includes("text"))
        .filter((m) => m.modalities?.output?.includes("text"))
        .filter((m) => m.reasoning)
        .filter((m) => !["alpha", "beta", "deprecated"].includes(m.status))
        .map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            efforts: true
        }));
}
