import React from "react";
import {DEFAULT_OPENAI_BASE_URL} from "src/core/ai-sdk/provider-config/constants";
import {ProviderConfigRepository} from "src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {isOAuthProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import {v4 as uuidv4} from "uuid";
import {getProviderConfigsSnapshot} from "./getProviderConfigsSnapshot";
import type {EditableProviderConfig, ProviderConfigValidationIssue} from "./types";

export function useProviderConfigDrafts() {
    const apiKeysRef = React.useRef(new Map<string, string>());
    const oauthStorageRef = React.useRef(new Map<string, Record<string, string>>());
    const [configs, setConfigs] = React.useState<EditableProviderConfig[]>([]);
    const [initialSnapshot, setInitialSnapshot] = React.useState("");
    const [activeEditorKey, setActiveEditorKey] = React.useState<string | null>(null);
    const [issues, setIssues] = React.useState<ProviderConfigValidationIssue[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    React.useEffect(() => {
        try {
            const loaded = ProviderConfigRepository.read().map((config) => {
                if (isOAuthProviderConfig(config)) {
                    oauthStorageRef.current.set(config.uuid, config.oauthStorage);
                } else {
                    apiKeysRef.current.set(config.uuid, config.apiKey);
                }
                return {...config, editorKey: uuidv4()};
            });
            setConfigs(loaded);
            setInitialSnapshot(getProviderConfigsSnapshot(loaded));
            setActiveEditorKey(loaded[0]?.editorKey ?? null);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearConfigIssues = React.useCallback((editorKey: string) => {
        setIssues((current) => current.filter((issue) => issue.editorKey !== editorKey));
    }, []);
    const updateConfig = React.useCallback(
        (editorKey: string, update: (config: EditableProviderConfig) => EditableProviderConfig) => {
            setConfigs((current) =>
                current.map((config) => (config.editorKey === editorKey ? update(config) : config))
            );
            clearConfigIssues(editorKey);
        },
        [clearConfigIssues]
    );
    const addConfig = React.useCallback(() => {
        const usedNames = new Set(configs.map((config) => config.name.trim().toLowerCase()));
        let ordinal = configs.length + 1;
        while (usedNames.has(`provider ${ordinal}`)) ordinal += 1;
        const config: EditableProviderConfig = {
            editorKey: uuidv4(),
            uuid: uuidv4(),
            name: `Provider ${ordinal}`,
            type: ProviderTypeEnum.OPENAI,
            baseUrl: DEFAULT_OPENAI_BASE_URL,
            apiKey: "",
            models: []
        };
        setConfigs((current) => [...current, config]);
        setActiveEditorKey(config.editorKey);
    }, [configs]);
    const deleteConfig = React.useCallback(
        (editorKey: string) => {
            setConfigs((current) => {
                const index = current.findIndex((config) => config.editorKey === editorKey);
                const next = current.filter((config) => config.editorKey !== editorKey);
                setActiveEditorKey(next[Math.max(0, index - 1)]?.editorKey ?? null);
                return next;
            });
            clearConfigIssues(editorKey);
        },
        [clearConfigIssues]
    );

    const changeProviderType = React.useCallback(
        (editorKey: string, type: ProviderTypeEnum, baseUrl: string) => {
            setConfigs((current) =>
                current.map((config) => {
                    if (config.editorKey !== editorKey || config.type === type) return config;
                    if (isOAuthProviderConfig(config)) {
                        oauthStorageRef.current.set(config.uuid, config.oauthStorage);
                    } else {
                        apiKeysRef.current.set(config.uuid, config.apiKey);
                    }
                    const common = {
                        editorKey: config.editorKey,
                        uuid: config.uuid,
                        name: config.name,
                        baseUrl,
                        models: config.models
                    };
                    return type === ProviderTypeEnum.CODEX_SUBSCRIPTION
                        ? {
                              ...common,
                              type,
                              oauthStorage: oauthStorageRef.current.get(config.uuid) ?? {}
                          }
                        : {
                              ...common,
                              type,
                              apiKey: apiKeysRef.current.get(config.uuid) ?? ""
                          };
                })
            );
            clearConfigIssues(editorKey);
        },
        [clearConfigIssues]
    );

    return {
        configs,
        setConfigs,
        initialSnapshot,
        activeEditorKey,
        setActiveEditorKey,
        activeConfig:
            configs.find((config) => config.editorKey === activeEditorKey) ?? configs[0] ?? null,
        issues,
        setIssues,
        isLoading,
        loadError,
        updateConfig,
        changeProviderType,
        addConfig,
        deleteConfig
    };
}
