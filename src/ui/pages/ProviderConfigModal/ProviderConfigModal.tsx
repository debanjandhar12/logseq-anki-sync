import {FlaskConical, Plus, RefreshCw, Trash} from "lucide-react";
import React from "react";
import {
    DEFAULT_CODEX_BASE_URL,
    DEFAULT_GOOGLE_BASE_URL,
    DEFAULT_OPENAI_BASE_URL,
    DEFAULT_OPENAI_COMPATIBLE_BASE_URL
} from "src/core/ai-sdk/provider-config/constants";
import {isOAuthProviderConfig, ProviderTypeEnum} from "src/core/ai-sdk/types";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
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
import {getProviderConfigsSnapshot} from "./getProviderConfigsSnapshot";
import {JinaWebToolsWarning} from "./JinaWebToolsWarning";
import {OAuthSignInSection} from "./OAuthSignInSection";
import type {ProviderConfigErrorField, ProviderConfigValidationIssue} from "./types";
import {useProviderConfigActions} from "./useProviderConfigActions";
import {useProviderConfigDrafts} from "./useProviderConfigDrafts";
import {useProviderConfigOAuth} from "./useProviderConfigOAuth";
import {useProviderConfigPersistence} from "./useProviderConfigPersistence";

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
    const {
        configs,
        initialSnapshot,
        setActiveEditorKey,
        activeConfig,
        issues,
        setIssues,
        isLoading,
        loadError,
        updateConfig,
        changeProviderType,
        addConfig,
        deleteConfig
    } = useProviderConfigDrafts();
    const formRef = React.useRef<HTMLDivElement>(null);
    const [isResetting, setIsResetting] = React.useState(false);
    const {open, setOpen, returnResult} = useModal<boolean | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false,
        enableEnterKey: false,
        enableOutsideClickClose: false,
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    const oauth = useProviderConfigOAuth(configs, updateConfig);
    const actions = useProviderConfigActions(
        updateConfig,
        oauth.getOAuthClient,
        oauth.captureClientChanges,
        oauth.isSignedIn
    );
    const hasUnsavedChanges =
        getProviderConfigsSnapshot(configs) !== initialSnapshot || oauth.authDirty;

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

    const handleValidationError = React.useCallback(
        (
            issue: ProviderConfigValidationIssue,
            validationIssues: ProviderConfigValidationIssue[]
        ) => {
            setIssues(validationIssues);
            if (issue.editorKey) setActiveEditorKey(issue.editorKey);
            focusIssue(issue);
        },
        [focusIssue, setActiveEditorKey, setIssues]
    );
    const persistence = useProviderConfigPersistence(
        configs,
        oauth.getOAuthStorageMutation,
        oauth.getChangedProviderUuids,
        oauth.isSignedIn,
        handleValidationError,
        () => returnResult(true)
    );
    const isBusy =
        loadError !== null ||
        persistence.isSaving ||
        actions.fetchingEditorKey !== null ||
        actions.testingEditorKey !== null ||
        oauth.isAuthBusy;

    const handleCancel = React.useCallback(async () => {
        if (
            persistence.isSaving ||
            actions.fetchingEditorKey !== null ||
            actions.testingEditorKey !== null ||
            oauth.isAuthBusy
        )
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
        actions.fetchingEditorKey,
        actions.testingEditorKey,
        hasUnsavedChanges,
        oauth.isAuthBusy,
        persistence.isSaving,
        returnResult
    ]);

    const handleReset = React.useCallback(async () => {
        if (isResetting) return;
        setIsResetting(true);
        try {
            await LogseqSettingAccessor.updatePluginSettings({providerConfigSetting: null});
            WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
        } catch {
            setIsResetting(false);
            await logseq.UI.showMsg("Failed to reset provider configurations.", "error");
        }
    }, [isResetting]);

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
                        <div className="m-5 space-y-3 rounded border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-600">
                            <p>
                                Provider configurations could not be loaded. Reset them to the
                                defaults and reload the plugin.
                            </p>
                            <LogseqButton
                                color="failed"
                                size="sm"
                                disabled={isResetting}
                                onClick={() => void handleReset()}>
                                {isResetting ? "Resetting..." : "Reset Provider Configurations"}
                            </LogseqButton>
                        </div>
                    ) : (
                        <>
                            <aside className="flex min-h-0 w-[240px] flex-shrink-0 flex-col border-border border-r bg-secondary-background">
                                <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
                                    <span className="text-sm font-medium">Configurations</span>
                                    <LogseqButton
                                        onClick={addConfig}
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
                                                        {config.name || "Untitled configuration"}
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
                                                {activeConfig.name || "Untitled configuration"}
                                            </div>
                                            <LogseqButton
                                                color="failed"
                                                size="xs"
                                                disabled={isBusy}
                                                title="Delete provider configuration"
                                                onClick={() => {
                                                    if (isOAuthProviderConfig(activeConfig)) {
                                                        oauth.markOAuthProviderChanged(
                                                            activeConfig.uuid
                                                        );
                                                    }
                                                    deleteConfig(activeConfig.editorKey);
                                                }}>
                                                <Trash size={15} /> Delete
                                            </LogseqButton>
                                        </div>
                                        <div
                                            ref={formRef}
                                            className="min-h-0 flex-1 overflow-y-auto p-5">
                                            <div className="mx-auto max-w-4xl space-y-5">
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <label
                                                        htmlFor={`provider-config-name-${activeConfig.editorKey}`}
                                                        className="space-y-1 text-sm font-medium">
                                                        <span>Configuration Name</span>
                                                        <LogseqInput
                                                            id={`provider-config-name-${activeConfig.editorKey}`}
                                                            data-error-field="name"
                                                            invalid={hasFieldIssue("name")}
                                                            value={activeConfig.name}
                                                            disabled={isBusy}
                                                            onChange={(event) =>
                                                                updateConfig(
                                                                    activeConfig.editorKey,
                                                                    (config) => ({
                                                                        ...config,
                                                                        name: event.target.value
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
                                                                if (
                                                                    isOAuthProviderConfig(
                                                                        activeConfig
                                                                    ) &&
                                                                    type !== activeConfig.type
                                                                ) {
                                                                    oauth.markOAuthProviderChanged(
                                                                        activeConfig.uuid
                                                                    );
                                                                }
                                                                changeProviderType(
                                                                    activeConfig.editorKey,
                                                                    type,
                                                                    getDefaultBaseUrl(type)
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
                                                {!isOAuthProviderConfig(activeConfig) && (
                                                    <label
                                                        htmlFor={`provider-api-key-${activeConfig.editorKey}`}
                                                        className="block space-y-1 text-sm font-medium">
                                                        <span>API Key</span>
                                                        <LogseqInput
                                                            id={`provider-api-key-${activeConfig.editorKey}`}
                                                            data-error-field="apiKey"
                                                            invalid={hasFieldIssue("apiKey")}
                                                            value={activeConfig.apiKey}
                                                            disabled={isBusy}
                                                            onChange={(event) =>
                                                                updateConfig(
                                                                    activeConfig.editorKey,
                                                                    (config) =>
                                                                        isOAuthProviderConfig(
                                                                            config
                                                                        )
                                                                            ? config
                                                                            : {
                                                                                  ...config,
                                                                                  apiKey: event
                                                                                      .target.value
                                                                              }
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                )}
                                                <JinaWebToolsWarning
                                                    providerType={activeConfig.type}
                                                />
                                                {isOAuthProviderConfig(activeConfig) && (
                                                    <div
                                                        data-error-field="authentication"
                                                        tabIndex={-1}>
                                                        <OAuthSignInSection
                                                            providerName="Codex Subscription"
                                                            prerequisite='Turn on "Enable device code authorization for Codex" in ChatGPT Settings > Security first.'
                                                            signedIn={oauth.isSignedIn(
                                                                activeConfig
                                                            )}
                                                            accountEmail={oauth.getAccountEmail(
                                                                activeConfig.uuid
                                                            )}
                                                            disabled={isBusy}
                                                            state={oauth.getSignInState(
                                                                activeConfig.editorKey
                                                            )}
                                                            onSignIn={() =>
                                                                void oauth.signIn(activeConfig)
                                                            }
                                                            onLogout={() =>
                                                                void oauth.logout(activeConfig)
                                                            }
                                                            onCancel={() =>
                                                                oauth.cancelSignIn(
                                                                    activeConfig.editorKey
                                                                )
                                                            }
                                                            onOpenVerificationUrl={
                                                                oauth.openVerificationUrl
                                                            }
                                                        />
                                                    </div>
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
                                                                onClick={() =>
                                                                    void actions.fetchModels(
                                                                        activeConfig
                                                                    )
                                                                }>
                                                                <RefreshCw size={14} />
                                                                {actions.fetchingEditorKey ===
                                                                activeConfig.editorKey
                                                                    ? "Fetching..."
                                                                    : "Fetch Models"}
                                                            </LogseqButton>
                                                            <LogseqButton
                                                                color="outline-link"
                                                                size="sm"
                                                                disabled={isBusy}
                                                                onClick={() =>
                                                                    void actions.test(activeConfig)
                                                                }>
                                                                <FlaskConical size={14} />
                                                                {actions.testingEditorKey ===
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
                    onConfirm={persistence.save}
                    onCancel={handleCancel}
                    confirmText={persistence.isSaving ? "Saving..." : "Save"}
                    cancelText="Cancel"
                    confirmShortcut=""
                    confirmDisabled={isBusy}
                    cancelDisabled={isBusy && loadError === null}
                    className="border-border border-t px-4 pb-2 pt-1 !mt-0"
                />
            </div>
        </Modal>
    );
};
