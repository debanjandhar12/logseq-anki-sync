import {FlaskConical, Plus, RefreshCw, Trash} from "lucide-react";
import React from "react";
import {type ProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqInput} from "../../components/LogseqInput";
import {LogseqSelect} from "../../components/LogseqSelect";
import {showConfirmModal} from "../../launchers/showConfirmModal";
import {Modal} from "../../modals/core/Modal";
import {ModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {getErrorMessage} from "../SkillEditorModal/utils/getErrorMessage";
import {CodexSignInSection} from "./CodexSignInSection";
import {
    DEFAULT_CODEX_BASE_URL,
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    discoverProviderModels,
    loadProviderConfigs,
    saveProviderConfigs,
    subscribeToCodexCredentialUpdates,
    verifyProviderConfig
} from "./providerConfigIntegration";
import {
    getProviderConfigsSnapshot,
    toPersistedProviderConfigs,
    validateProviderConfigs
} from "./providerConfigValidation";
import type {
    EditableProviderConfig,
    ProviderConfigErrorField,
    ProviderConfigValidationIssue
} from "./types";

export interface ProviderConfigModalProps {
    resolve: (value: boolean | null) => void;
    reject: (error: unknown) => void;
    modalContext?: {modalId: string | null};
}

const PROVIDER_OPTIONS = [
    {value: ProviderTypeEnum.OPENAI, label: "OpenAI"},
    {value: ProviderTypeEnum.OPENAI_COMPATIBLE, label: "OpenAI Compatible"},
    {value: ProviderTypeEnum.GOOGLE, label: "Google Gemini"},
    {value: ProviderTypeEnum.CODEX_SUBSCRIPTION, label: "Codex Subscription"}
];

function createEditorConfig(config: ProviderConfig): EditableProviderConfig {
    return {
        ...config,
        editorKey: crypto.randomUUID(),
        originalId: config.id,
        codexCredentialIntent: "unchanged"
    };
}

function getDefaultBaseUrl(type: ProviderTypeEnum): string {
    if (type === ProviderTypeEnum.OPENAI) return DEFAULT_OPENAI_BASE_URL;
    if (type === ProviderTypeEnum.GOOGLE) return DEFAULT_GOOGLE_BASE_URL;
    if (type === ProviderTypeEnum.CODEX_SUBSCRIPTION) return DEFAULT_CODEX_BASE_URL;
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

export const ProviderConfigModalComponent: React.FC<ProviderConfigModalProps> = ({
    resolve,
    modalContext
}) => {
    const [configs, setConfigs] = React.useState<EditableProviderConfig[]>([]);
    const [initialSnapshot, setInitialSnapshot] = React.useState("");
    const [activeEditorKey, setActiveEditorKey] = React.useState<string | null>(null);
    const [issues, setIssues] = React.useState<ProviderConfigValidationIssue[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [fetchingEditorKey, setFetchingEditorKey] = React.useState<string | null>(null);
    const [testingEditorKey, setTestingEditorKey] = React.useState<string | null>(null);
    const [codexAuthBusy, setCodexAuthBusy] = React.useState(false);
    const formRef = React.useRef<HTMLDivElement>(null);
    const {open, setOpen, returnResult} = useModal<boolean | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false,
        enableEnterKey: false,
        enableOutsideClickClose: false,
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    React.useEffect(() => {
        try {
            const loadedConfigs = loadProviderConfigs().map(createEditorConfig);
            const snapshot = getProviderConfigsSnapshot(loadedConfigs);
            setConfigs(loadedConfigs);
            setInitialSnapshot(snapshot);
            setActiveEditorKey(loadedConfigs[0]?.editorKey ?? null);
        } catch (error) {
            const message = getErrorMessage(error);
            setLoadError(message);
            void logseq.UI.showMsg(`Failed to load provider configurations: ${message}`, "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(
        () =>
            subscribeToCodexCredentialUpdates(({providerId, encodedCredentials}) => {
                setInitialSnapshot((current) => {
                    try {
                        const snapshotConfigs = JSON.parse(current) as EditableProviderConfig[];
                        return getProviderConfigsSnapshot(
                            snapshotConfigs.map((config) =>
                                config.originalId === providerId &&
                                config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION &&
                                config.codexCredentialIntent === "unchanged"
                                    ? {...config, apiKey: encodedCredentials}
                                    : config
                            )
                        );
                    } catch {
                        return current;
                    }
                });
                setConfigs((current) => {
                    return current.map((config) => {
                        if (
                            config.originalId !== providerId ||
                            config.type !== ProviderTypeEnum.CODEX_SUBSCRIPTION ||
                            config.codexCredentialIntent !== "unchanged"
                        ) {
                            return config;
                        }
                        return {...config, apiKey: encodedCredentials};
                    });
                });
            }),
        []
    );

    const activeConfig =
        configs.find((config) => config.editorKey === activeEditorKey) ?? configs[0] ?? null;
    const hasUnsavedChanges = getProviderConfigsSnapshot(configs) !== initialSnapshot;
    const isBusy =
        loadError !== null ||
        isSaving ||
        fetchingEditorKey !== null ||
        testingEditorKey !== null ||
        codexAuthBusy;

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

    const handleAddConfig = React.useCallback(() => {
        if (isBusy) return;
        const usedIds = new Set(configs.map((config) => config.id));
        let suffix = configs.length + 1;
        while (usedIds.has(`provider-${suffix}`)) suffix += 1;
        const config: EditableProviderConfig = {
            editorKey: crypto.randomUUID(),
            id: `provider-${suffix}`,
            type: ProviderTypeEnum.OPENAI,
            baseUrl: DEFAULT_OPENAI_BASE_URL,
            apiKey: "",
            models: [],
            codexCredentialIntent: "unchanged"
        };
        setConfigs((current) => [...current, config]);
        setActiveEditorKey(config.editorKey);
    }, [configs, isBusy]);

    const handleDeleteConfig = React.useCallback(() => {
        if (!activeConfig || isBusy) return;
        setConfigs((current) => {
            const activeIndex = current.findIndex(
                (config) => config.editorKey === activeConfig.editorKey
            );
            const next = current.filter((config) => config.editorKey !== activeConfig.editorKey);
            setActiveEditorKey(next[Math.max(0, activeIndex - 1)]?.editorKey ?? null);
            return next;
        });
        clearConfigIssues(activeConfig.editorKey);
    }, [activeConfig, clearConfigIssues, isBusy]);

    const getActionValidationError = React.useCallback(
        (config: EditableProviderConfig, requireModel: boolean): string | null => {
            if (!config.baseUrl.trim()) return "Enter a Base URL first.";
            try {
                const url = new URL(config.baseUrl.trim());
                if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
                    return "Enter a valid HTTP or HTTPS Base URL without embedded credentials.";
                }
            } catch {
                return "Enter a valid Base URL first.";
            }
            if (config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
                if (!config.apiKey) return "Sign in to Codex Subscription first.";
            } else if (!config.apiKey.trim()) {
                return "Enter an API key first.";
            }
            if (requireModel && !config.models.some((model) => model.enabled && model.id.trim())) {
                return "Enable at least one model first.";
            }
            return null;
        },
        []
    );

    const handleFetchModels = React.useCallback(async () => {
        if (!activeConfig || isBusy) return;
        const validationError = getActionValidationError(activeConfig, false);
        if (validationError) {
            await logseq.UI.showMsg(validationError, "error");
            return;
        }
        setFetchingEditorKey(activeConfig.editorKey);
        try {
            const models = await discoverProviderModels(activeConfig, (encodedCredentials) =>
                updateConfig(activeConfig.editorKey, (config) => ({
                    ...config,
                    apiKey: encodedCredentials,
                    codexCredentialIntent: "replace"
                }))
            );
            updateConfig(activeConfig.editorKey, (config) => ({...config, models}));
            await logseq.UI.showMsg("Provider models fetched successfully.", "success");
        } catch (error) {
            const message = getErrorMessage(error);
            await logseq.UI.showMsg(`Failed to fetch provider models: ${message}`, "error");
        } finally {
            setFetchingEditorKey(null);
        }
    }, [activeConfig, getActionValidationError, isBusy, updateConfig]);

    const handleTest = React.useCallback(async () => {
        if (!activeConfig || isBusy) return;
        const validationError = getActionValidationError(activeConfig, true);
        if (validationError) {
            await logseq.UI.showMsg(validationError, "error");
            return;
        }
        setTestingEditorKey(activeConfig.editorKey);
        try {
            await verifyProviderConfig(activeConfig, (encodedCredentials) =>
                updateConfig(activeConfig.editorKey, (config) => ({
                    ...config,
                    apiKey: encodedCredentials,
                    codexCredentialIntent: "replace"
                }))
            );
            await logseq.UI.showMsg("Provider connection test succeeded.", "success");
        } catch (error) {
            const message = getErrorMessage(error);
            await logseq.UI.showMsg(`Provider connection test failed: ${message}`, "error");
        } finally {
            setTestingEditorKey(null);
        }
    }, [activeConfig, getActionValidationError, isBusy, updateConfig]);

    const focusIssue = React.useCallback((issue: ProviderConfigValidationIssue) => {
        setTimeout(() => {
            const selector =
                issue.modelIndex == null
                    ? `[data-error-field="${issue.field}"]`
                    : `[data-model-index="${issue.modelIndex}"]`;
            const element = formRef.current?.querySelector<HTMLElement>(selector);
            element?.scrollIntoView({block: "nearest"});
            element?.focus();
        }, 0);
    }, []);

    const handleSave = React.useCallback(async () => {
        if (isBusy) return;
        const validationIssues = validateProviderConfigs(configs);
        if (validationIssues.length > 0) {
            const firstIssue = validationIssues[0];
            setIssues(validationIssues);
            if (firstIssue.editorKey) {
                setActiveEditorKey(firstIssue.editorKey);
                focusIssue(firstIssue);
            }
            await logseq.UI.showMsg(`Validation failed: ${firstIssue.message}`, "error");
            return;
        }

        setIsSaving(true);
        try {
            const persistedConfigs = toPersistedProviderConfigs(configs);
            const renamedIds = new Map(
                configs
                    .filter((config) => config.originalId && config.originalId !== config.id.trim())
                    .map((config) => [config.originalId as string, config.id.trim().toLowerCase()])
            );
            await saveProviderConfigs(
                persistedConfigs.map((config, index) => ({
                    config,
                    originalId: configs[index].originalId,
                    codexCredentialIntent: configs[index].codexCredentialIntent
                })),
                renamedIds
            );
            returnResult(true);
        } catch {
            await logseq.UI.showMsg("Failed to save provider configurations.", "error");
        } finally {
            setIsSaving(false);
        }
    }, [configs, focusIssue, isBusy, returnResult]);

    const handleCancel = React.useCallback(async () => {
        if (isSaving || fetchingEditorKey !== null || testingEditorKey !== null || codexAuthBusy)
            return;
        if (hasUnsavedChanges) {
            const shouldClose = await showConfirmModal(
                "You have unsaved provider configuration changes. Close without saving?",
                {confirmText: "Close without saving", cancelText: "Keep editing"}
            );
            if (!shouldClose) return;
        }
        returnResult(null);
    }, [
        codexAuthBusy,
        fetchingEditorKey,
        hasUnsavedChanges,
        isSaving,
        returnResult,
        testingEditorKey
    ]);

    const activeIssues = activeConfig
        ? issues.filter((issue) => issue.editorKey === activeConfig.editorKey)
        : [];
    const hasFieldIssue = (field: ProviderConfigErrorField) =>
        activeIssues.some((issue) => issue.field === field && issue.modelIndex == null);
    const hasModelIssue = (modelIndex: number) =>
        activeIssues.some((issue) => issue.field === "models" && issue.modelIndex === modelIndex);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            size="large"
            zDepth="high"
            hasCloseButton={false}
            className="overflow-hidden">
            <div className="flex max-h-[90vh] min-h-[70vh] flex-col text-text">
                <ModalHeader
                    title="Provider Configurations"
                    showCloseButton={false}
                    onClose={handleCancel}
                />
                <div className="min-h-0 flex-1 flex overflow-hidden border-border border-t">
                    {isLoading ? (
                        <div className="p-4 text-sm opacity-80">
                            Loading provider configurations...
                        </div>
                    ) : loadError ? (
                        <div className="m-5 rounded border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-600">
                            Provider configurations could not be loaded. Close this modal without
                            saving and correct the stored configuration before trying again.
                        </div>
                    ) : (
                        <>
                            <aside className="flex min-h-0 w-[240px] flex-shrink-0 flex-col border-border border-r bg-secondary-background">
                                <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
                                    <span className="text-sm font-medium">Configurations</span>
                                    <LogseqButton
                                        onClick={handleAddConfig}
                                        color="primary"
                                        size="xs"
                                        disabled={isBusy}
                                        title="Add provider configuration">
                                        <Plus size={16} />
                                    </LogseqButton>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                    {configs.length === 0 ? (
                                        <div className="px-2 py-3 text-sm opacity-70">
                                            No provider configurations yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {configs.map((config) => (
                                                <button
                                                    key={config.editorKey}
                                                    type="button"
                                                    disabled={isBusy}
                                                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                                                        config.editorKey === activeConfig?.editorKey
                                                            ? "border border-border bg-primary-background font-medium shadow-sm"
                                                            : "bg-transparent hover:bg-tertiary/50"
                                                    }`}
                                                    onClick={() =>
                                                        setActiveEditorKey(config.editorKey)
                                                    }>
                                                    <span className="block truncate">
                                                        {config.id || "Untitled configuration"}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </aside>
                            <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
                                {activeConfig ? (
                                    <>
                                        <div className="flex items-center justify-between gap-3 border-border border-b bg-secondary-background px-4 py-2">
                                            <div className="min-w-0 truncate text-sm font-medium">
                                                {activeConfig.id || "Untitled configuration"}
                                            </div>
                                            <LogseqButton
                                                color="failed"
                                                size="xs"
                                                disabled={isBusy}
                                                title="Delete provider configuration"
                                                onClick={handleDeleteConfig}>
                                                <Trash size={15} /> Delete
                                            </LogseqButton>
                                        </div>
                                        <div
                                            ref={formRef}
                                            className="min-h-0 flex-1 overflow-y-auto p-5">
                                            <div className="mx-auto max-w-4xl space-y-5">
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <label
                                                        htmlFor={`provider-config-id-${activeConfig.editorKey}`}
                                                        className="space-y-1 text-sm font-medium">
                                                        <span>Configuration ID</span>
                                                        <LogseqInput
                                                            id={`provider-config-id-${activeConfig.editorKey}`}
                                                            data-error-field="id"
                                                            invalid={hasFieldIssue("id")}
                                                            value={activeConfig.id}
                                                            disabled={isBusy}
                                                            onChange={(event) =>
                                                                updateConfig(
                                                                    activeConfig.editorKey,
                                                                    (config) => ({
                                                                        ...config,
                                                                        id: event.target.value.toLowerCase()
                                                                    })
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                    <label
                                                        htmlFor={`provider-type-${activeConfig.editorKey}`}
                                                        className="space-y-1 text-sm font-medium">
                                                        <span>Provider</span>
                                                        <LogseqSelect
                                                            id={`provider-type-${activeConfig.editorKey}`}
                                                            value={activeConfig.type}
                                                            disabled={isBusy}
                                                            invalid={hasFieldIssue("type")}
                                                            errorField="type"
                                                            width="100%"
                                                            options={PROVIDER_OPTIONS}
                                                            onChange={(value) => {
                                                                const type =
                                                                    value as ProviderTypeEnum;
                                                                updateConfig(
                                                                    activeConfig.editorKey,
                                                                    (config) => ({
                                                                        ...config,
                                                                        type,
                                                                        baseUrl:
                                                                            getDefaultBaseUrl(type),
                                                                        apiKey: "",
                                                                        models: [],
                                                                        codexCredentialIntent:
                                                                            type ===
                                                                            ProviderTypeEnum.CODEX_SUBSCRIPTION
                                                                                ? "clear"
                                                                                : "unchanged"
                                                                    })
                                                                );
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                                <label
                                                    htmlFor={`provider-base-url-${activeConfig.editorKey}`}
                                                    className="block space-y-1 text-sm font-medium">
                                                    <span>Base URL</span>
                                                    <LogseqInput
                                                        id={`provider-base-url-${activeConfig.editorKey}`}
                                                        data-error-field="baseUrl"
                                                        invalid={hasFieldIssue("baseUrl")}
                                                        value={activeConfig.baseUrl}
                                                        disabled={
                                                            isBusy ||
                                                            activeConfig.type !==
                                                                ProviderTypeEnum.OPENAI_COMPATIBLE
                                                        }
                                                        placeholder="https://provider.example/v1"
                                                        onChange={(event) =>
                                                            updateConfig(
                                                                activeConfig.editorKey,
                                                                (config) => ({
                                                                    ...config,
                                                                    baseUrl: event.target.value
                                                                })
                                                            )
                                                        }
                                                    />
                                                    {activeConfig.type ===
                                                        ProviderTypeEnum.OPENAI_COMPATIBLE && (
                                                        <span className="block text-xs font-normal opacity-70">
                                                            Enter the API base URL.
                                                        </span>
                                                    )}
                                                </label>
                                                <label
                                                    htmlFor={`provider-api-key-${activeConfig.editorKey}`}
                                                    className="block space-y-1 text-sm font-medium">
                                                    <span>API Key</span>
                                                    <LogseqInput
                                                        id={`provider-api-key-${activeConfig.editorKey}`}
                                                        data-error-field="apiKey"
                                                        invalid={hasFieldIssue("apiKey")}
                                                        value={
                                                            activeConfig.type ===
                                                            ProviderTypeEnum.CODEX_SUBSCRIPTION
                                                                ? ""
                                                                : activeConfig.apiKey
                                                        }
                                                        placeholder={
                                                            activeConfig.type ===
                                                            ProviderTypeEnum.CODEX_SUBSCRIPTION
                                                                ? "Managed by Codex Subscription sign-in"
                                                                : undefined
                                                        }
                                                        disabled={
                                                            isBusy ||
                                                            activeConfig.type ===
                                                                ProviderTypeEnum.CODEX_SUBSCRIPTION
                                                        }
                                                        onChange={(event) =>
                                                            updateConfig(
                                                                activeConfig.editorKey,
                                                                (config) => ({
                                                                    ...config,
                                                                    apiKey: event.target.value
                                                                })
                                                            )
                                                        }
                                                    />
                                                </label>
                                                {activeConfig.type ===
                                                    ProviderTypeEnum.CODEX_SUBSCRIPTION && (
                                                    <CodexSignInSection
                                                        encodedCredentials={activeConfig.apiKey}
                                                        disabled={isBusy && !codexAuthBusy}
                                                        onBusyChange={setCodexAuthBusy}
                                                        onSignedIn={(encodedCredentials) =>
                                                            updateConfig(
                                                                activeConfig.editorKey,
                                                                (config) => ({
                                                                    ...config,
                                                                    apiKey: encodedCredentials,
                                                                    codexCredentialIntent: "replace"
                                                                })
                                                            )
                                                        }
                                                        onLogout={() =>
                                                            updateConfig(
                                                                activeConfig.editorKey,
                                                                (config) => ({
                                                                    ...config,
                                                                    apiKey: "",
                                                                    codexCredentialIntent: "clear"
                                                                })
                                                            )
                                                        }
                                                    />
                                                )}
                                                <div className="rounded-md border border-border">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-secondary-background px-3 py-2">
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                Models
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center">
                                                            <LogseqButton
                                                                color="outline-link"
                                                                size="sm"
                                                                disabled={isBusy}
                                                                onClick={handleFetchModels}>
                                                                <RefreshCw size={14} />
                                                                {fetchingEditorKey ===
                                                                activeConfig.editorKey
                                                                    ? "Fetching..."
                                                                    : "Fetch Models"}
                                                            </LogseqButton>
                                                            <LogseqButton
                                                                color="outline-link"
                                                                size="sm"
                                                                disabled={isBusy}
                                                                onClick={handleTest}>
                                                                <FlaskConical size={14} />
                                                                {testingEditorKey ===
                                                                activeConfig.editorKey
                                                                    ? "Testing..."
                                                                    : "Test"}
                                                            </LogseqButton>
                                                            <LogseqButton
                                                                color="primary"
                                                                size="sm"
                                                                disabled={isBusy}
                                                                onClick={() =>
                                                                    updateConfig(
                                                                        activeConfig.editorKey,
                                                                        (config) => ({
                                                                            ...config,
                                                                            models: [
                                                                                ...config.models,
                                                                                {
                                                                                    id: "",
                                                                                    enabled: true
                                                                                }
                                                                            ]
                                                                        })
                                                                    )
                                                                }>
                                                                <Plus size={14} /> Add Model
                                                            </LogseqButton>
                                                        </div>
                                                    </div>
                                                    <div
                                                        data-error-field="models"
                                                        tabIndex={-1}
                                                        aria-invalid={hasFieldIssue("models")}
                                                        className={`p-2 ${hasFieldIssue("models") ? "ring-1 ring-inset ring-red-500" : ""}`}>
                                                        {activeConfig.models.length === 0 ? (
                                                            <div className="px-2 py-5 text-center text-sm opacity-70">
                                                                Fetch models or add one manually.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {activeConfig.models.map(
                                                                    (model, modelIndex) => (
                                                                        <div
                                                                            // biome-ignore lint/suspicious/noArrayIndexKey: model rows have no persisted identity beyond their position.
                                                                            key={`${activeConfig.editorKey}-${modelIndex}`}
                                                                            className="flex items-center gap-2">
                                                                            <LogseqCheckbox
                                                                                checked={
                                                                                    model.enabled
                                                                                }
                                                                                disabled={isBusy}
                                                                                onChange={() =>
                                                                                    updateConfig(
                                                                                        activeConfig.editorKey,
                                                                                        (
                                                                                            config
                                                                                        ) => ({
                                                                                            ...config,
                                                                                            models: config.models.map(
                                                                                                (
                                                                                                    item,
                                                                                                    index
                                                                                                ) =>
                                                                                                    index ===
                                                                                                    modelIndex
                                                                                                        ? {
                                                                                                              ...item,
                                                                                                              enabled:
                                                                                                                  !item.enabled
                                                                                                          }
                                                                                                        : item
                                                                                            )
                                                                                        })
                                                                                    )
                                                                                }
                                                                            />
                                                                            <LogseqInput
                                                                                data-model-index={
                                                                                    modelIndex
                                                                                }
                                                                                invalid={hasModelIssue(
                                                                                    modelIndex
                                                                                )}
                                                                                value={model.id}
                                                                                disabled={isBusy}
                                                                                placeholder="Model ID"
                                                                                onChange={(
                                                                                    event
                                                                                ) => {
                                                                                    const id =
                                                                                        event.target
                                                                                            .value;
                                                                                    updateConfig(
                                                                                        activeConfig.editorKey,
                                                                                        (
                                                                                            config
                                                                                        ) => ({
                                                                                            ...config,
                                                                                            models: config.models.map(
                                                                                                (
                                                                                                    item,
                                                                                                    index
                                                                                                ) =>
                                                                                                    index ===
                                                                                                    modelIndex
                                                                                                        ? {
                                                                                                              ...item,
                                                                                                              id
                                                                                                          }
                                                                                                        : item
                                                                                            )
                                                                                        })
                                                                                    );
                                                                                }}
                                                                            />
                                                                            <LogseqButton
                                                                                color="failed"
                                                                                size="xs"
                                                                                disabled={isBusy}
                                                                                title="Delete model"
                                                                                onClick={() =>
                                                                                    updateConfig(
                                                                                        activeConfig.editorKey,
                                                                                        (
                                                                                            config
                                                                                        ) => ({
                                                                                            ...config,
                                                                                            models: config.models.filter(
                                                                                                (
                                                                                                    _item,
                                                                                                    index
                                                                                                ) =>
                                                                                                    index !==
                                                                                                    modelIndex
                                                                                            )
                                                                                        })
                                                                                    )
                                                                                }>
                                                                                <Trash size={14} />
                                                                            </LogseqButton>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {activeIssues.length > 0 && (
                                                    <div className="rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                                                        {activeIssues[0].message}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center p-4 text-sm opacity-70">
                                        Add a provider configuration to get started.
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>
                <ModalFooter
                    onConfirm={handleSave}
                    onCancel={handleCancel}
                    confirmText={isSaving ? "Saving..." : "Save"}
                    cancelText="Cancel"
                    confirmShortcut=""
                    className="border-border border-t px-4 pb-2 pt-1 !mt-0"
                />
            </div>
        </Modal>
    );
};
