import type {AuthStorage} from "@ai-oauth-sdk/browser";
import {ProviderConfigRepository} from "../provider-config/ProviderConfigRepository";
import {isOAuthProviderConfig} from "../types";

export class ProviderConfigSettingOAuthStorage implements AuthStorage {
    private readonly lastReadValues = new Map<string, string | null>();

    constructor(
        private readonly providerUuid: string,
        private readonly onConflict?: () => void
    ) {}

    async get(key: string): Promise<string | null> {
        const config = ProviderConfigRepository.read().find(
            (candidate) => candidate.uuid === this.providerUuid
        );
        const value =
            config && isOAuthProviderConfig(config) ? (config.oauthStorage[key] ?? null) : null;
        this.lastReadValues.set(key, value);
        return value;
    }

    async set(key: string, value: string): Promise<void> {
        await ProviderConfigRepository.updateOAuthStorage(this.providerUuid, (storage) => ({
            ...this.requireUnchangedValue(storage, key),
            [key]: value
        }));
        this.lastReadValues.set(key, value);
    }

    async delete(key: string): Promise<void> {
        await ProviderConfigRepository.updateOAuthStorage(this.providerUuid, (storage) => {
            this.requireUnchangedValue(storage, key);
            delete storage[key];
            return storage;
        });
        this.lastReadValues.set(key, null);
    }

    async keys(): Promise<string[]> {
        const config = ProviderConfigRepository.read().find(
            (candidate) => candidate.uuid === this.providerUuid
        );
        return config && isOAuthProviderConfig(config) ? Object.keys(config.oauthStorage) : [];
    }

    private requireUnchangedValue(
        storage: Record<string, string>,
        key: string
    ): Record<string, string> {
        const current = storage[key] ?? null;
        const expected = this.lastReadValues.get(key) ?? null;
        if (current !== expected) {
            this.onConflict?.();
            throw new Error("OAuth credentials changed during update");
        }
        return storage;
    }
}
