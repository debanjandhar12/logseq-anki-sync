import React from "react";
import {OAuthClientCache} from "src/core/ai-sdk/oauth/OAuthClientCache";
import {
    ProviderConfigRepository,
    type ProviderConfigSaveDraft
} from "src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {isOAuthProviderConfig} from "src/core/ai-sdk/types";
import {toPersistedProviderConfigs} from "./toPersistedProviderConfigs";
import type {EditableProviderConfig, ProviderConfigValidationIssue} from "./types";
import {validateProviderConfigs} from "./validation";

export function useProviderConfigPersistence(
    configs: EditableProviderConfig[],
    getOAuthStorageMutation: (
        providerUuid: string
    ) => ProviderConfigSaveDraft["oauthStorageMutation"],
    getChangedProviderUuids: () => string[],
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean,
    onValidationError: (
        issue: ProviderConfigValidationIssue,
        issues: ProviderConfigValidationIssue[]
    ) => void,
    onSaved: () => void
) {
    const [isSaving, setIsSaving] = React.useState(false);
    const savingRef = React.useRef(false);
    const save = React.useCallback(async () => {
        if (savingRef.current) return;
        const issues = validateProviderConfigs(configs, isOAuthSignedIn);
        if (issues.length > 0) {
            onValidationError(issues[0], issues);
            await logseq.UI.showMsg(`Validation failed: ${issues[0].message}`, "error");
            return;
        }
        savingRef.current = true;
        setIsSaving(true);
        try {
            const drafts = toPersistedProviderConfigs(configs).map((config) => ({
                config,
                oauthStorageMutation: isOAuthProviderConfig(config)
                    ? getOAuthStorageMutation(config.uuid)
                    : undefined
            }));
            await ProviderConfigRepository.save(drafts);
            for (const providerUuid of getChangedProviderUuids()) {
                OAuthClientCache.invalidate(providerUuid);
            }
            onSaved();
        } catch {
            await logseq.UI.showMsg("Failed to save provider configurations.", "error");
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    }, [
        configs,
        getChangedProviderUuids,
        getOAuthStorageMutation,
        isOAuthSignedIn,
        onSaved,
        onValidationError
    ]);
    return {isSaving, save};
}
