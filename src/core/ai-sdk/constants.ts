import {ProviderEnum} from "./types";

export const PROVIDER_SNAPSHOT_KEY: Partial<Record<ProviderEnum, string>> = {
    [ProviderEnum.OPENAI]: "openai",
    [ProviderEnum.GOOGLE]: "google"
};
