import type {AuthClient} from "@ai-oauth-sdk/browser";
import React from "react";
import {fetchProviderModels} from "src/core/ai-sdk/provider-config/fetchProviderModels";
import {mergeProviderModels} from "src/core/ai-sdk/provider-config/mergeProviderModels";
import {testProviderConfig} from "src/core/ai-sdk/provider-config/testProviderConfig";
import {isOAuthProviderConfig} from "src/core/ai-sdk/types";
import {getErrorMessage} from "../SkillEditorModal/utils/getErrorMessage";
import type {EditableProviderConfig} from "./types";
import {getProviderConfigActionValidationMessage} from "./validation";

export function useProviderConfigActions(
    updateConfig: (
        editorKey: string,
        update: (config: EditableProviderConfig) => EditableProviderConfig
    ) => void,
    getOAuthClient: (config: EditableProviderConfig) => AuthClient | undefined,
    captureClientChanges: (config: EditableProviderConfig) => Promise<void>,
    isOAuthSignedIn: (config: EditableProviderConfig) => boolean
) {
    const [fetchingEditorKey, setFetchingEditorKey] = React.useState<string | null>(null);
    const [testingEditorKey, setTestingEditorKey] = React.useState<string | null>(null);

    const fetchModels = React.useCallback(
        async (config: EditableProviderConfig) => {
            const validationError = getProviderConfigActionValidationMessage(config, {
                requireEnabledModel: false,
                isOAuthSignedIn
            });
            if (validationError) return void (await logseq.UI.showMsg(validationError, "error"));
            setFetchingEditorKey(config.editorKey);
            try {
                const fetchedModels = await fetchProviderModels(config, getOAuthClient(config));
                const models = mergeProviderModels(config.models, fetchedModels);
                updateConfig(config.editorKey, (current) => ({...current, models}));
                await logseq.UI.showMsg("Provider models fetched successfully.", "success");
            } catch (error) {
                await logseq.UI.showMsg(
                    `Failed to fetch provider models: ${getErrorMessage(error)}`,
                    "error"
                );
            } finally {
                if (isOAuthProviderConfig(config)) {
                    await captureClientChanges(config).catch(() => undefined);
                }
                setFetchingEditorKey(null);
            }
        },
        [captureClientChanges, getOAuthClient, isOAuthSignedIn, updateConfig]
    );

    const test = React.useCallback(
        async (config: EditableProviderConfig) => {
            const validationError = getProviderConfigActionValidationMessage(config, {
                requireEnabledModel: true,
                isOAuthSignedIn
            });
            if (validationError) return void (await logseq.UI.showMsg(validationError, "error"));
            setTestingEditorKey(config.editorKey);
            try {
                await testProviderConfig(config, getOAuthClient(config));
                await logseq.UI.showMsg("Provider connection test succeeded.", "success");
            } catch (error) {
                await logseq.UI.showMsg(
                    `Provider connection test failed: ${getErrorMessage(error)}`,
                    "error"
                );
            } finally {
                if (isOAuthProviderConfig(config)) {
                    await captureClientChanges(config).catch(() => undefined);
                }
                setTestingEditorKey(null);
            }
        },
        [captureClientChanges, getOAuthClient, isOAuthSignedIn]
    );

    return {fetchingEditorKey, testingEditorKey, fetchModels, test};
}
