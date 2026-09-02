import {type AuthClient, type AuthStorage, memoryStorage} from "@ai-oauth-sdk/browser";
import React from "react";
import {createCodexOAuthClient} from "src/core/ai-sdk/oauth/createCodexOAuthClient";
import type {OAuthStorageMutation} from "src/core/ai-sdk/provider-config/ProviderConfigRepository";
import {
    isOAuthProviderConfig,
    type OAuthProviderConfig,
    ProviderTypeEnum
} from "src/core/ai-sdk/types";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import type {EditableProviderConfig, OAuthSignInState} from "./types";

interface DraftOAuthClient {
    client: AuthClient;
    storage: AuthStorage;
    baseline: Record<string, string>;
}

interface OAuthAccountState {
    signedIn: boolean;
    email?: string;
}

async function readStorage(storage: AuthStorage): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of (await storage.keys?.()) ?? []) {
        const value = await storage.get(key);
        if (value !== null) result[key] = value;
    }
    return result;
}

export function useProviderConfigOAuth(
    configs: EditableProviderConfig[],
    updateConfig: (
        editorKey: string,
        update: (config: EditableProviderConfig) => EditableProviderConfig
    ) => void
) {
    const clientsRef = React.useRef(new Map<string, DraftOAuthClient>());
    const mutationsRef = React.useRef(new Map<string, OAuthStorageMutation>());
    const changedProviderUuidsRef = React.useRef(new Set<string>());
    const attemptsRef = React.useRef(new Map<string, number>());
    const controllersRef = React.useRef(new Map<string, AbortController>());
    const [states, setStates] = React.useState<Record<string, OAuthSignInState>>({});
    const [authDirtyVersion, setAuthDirtyVersion] = React.useState(0);
    const [accounts, setAccounts] = React.useState<Record<string, OAuthAccountState>>({});

    const getDraftClient = React.useCallback((config: OAuthProviderConfig): DraftOAuthClient => {
        const existing = clientsRef.current.get(config.uuid);
        if (existing) return existing;
        const baseline = {...config.oauthStorage};
        const storage = memoryStorage(new Map(Object.entries(baseline)));
        const draft = {client: createCodexOAuthClient(config, storage), storage, baseline};
        clientsRef.current.set(config.uuid, draft);
        return draft;
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        void Promise.all(
            configs
                .filter((config): config is EditableProviderConfig & OAuthProviderConfig =>
                    isOAuthProviderConfig(config)
                )
                .map(async (config) => {
                    const tokens = await getDraftClient(config).client.getTokens();
                    return [
                        config.uuid,
                        {
                            signedIn: tokens !== undefined,
                            ...(tokens?.email ? {email: tokens.email} : {})
                        }
                    ] as const;
                })
        ).then((entries) => {
            if (!cancelled) setAccounts(Object.fromEntries(entries));
        });
        return () => {
            cancelled = true;
        };
    }, [configs, getDraftClient]);

    const syncStorage = React.useCallback(
        async (config: EditableProviderConfig, mutationKind: "replace" | "compare-and-set") => {
            if (!isOAuthProviderConfig(config)) return;
            const draft = getDraftClient(config);
            const oauthStorage = await readStorage(draft.storage);
            if (
                mutationKind === "compare-and-set" &&
                JSON.stringify(oauthStorage) === JSON.stringify(config.oauthStorage)
            ) {
                return;
            }
            const mutation: OAuthStorageMutation =
                mutationKind === "replace"
                    ? {kind: "replace", oauthStorage}
                    : {kind: "compare-and-set", baseline: draft.baseline, oauthStorage};
            mutationsRef.current.set(config.uuid, mutation);
            changedProviderUuidsRef.current.add(config.uuid);
            updateConfig(config.editorKey, (current) =>
                isOAuthProviderConfig(current) ? {...current, oauthStorage} : current
            );
            setAuthDirtyVersion((version) => version + 1);
        },
        [getDraftClient, updateConfig]
    );

    const cancelSignIn = React.useCallback((editorKey: string) => {
        attemptsRef.current.set(editorKey, (attemptsRef.current.get(editorKey) ?? 0) + 1);
        controllersRef.current.get(editorKey)?.abort();
        controllersRef.current.delete(editorKey);
        setStates((current) => ({...current, [editorKey]: {status: "idle"}}));
    }, []);

    const signIn = React.useCallback(
        async (config: EditableProviderConfig) => {
            if (!isOAuthProviderConfig(config)) return;
            cancelSignIn(config.editorKey);
            const attempt = attemptsRef.current.get(config.editorKey) ?? 0;
            const controller = new AbortController();
            controllersRef.current.set(config.editorKey, controller);
            setStates((current) => ({...current, [config.editorKey]: {status: "starting"}}));
            try {
                const draft = getDraftClient(config);
                const tokens = await draft.client.deviceLogin({
                    signal: controller.signal,
                    onCode: ({userCode, verificationUri, verificationUriComplete}) => {
                        if (
                            controller.signal.aborted ||
                            attemptsRef.current.get(config.editorKey) !== attempt
                        )
                            return;
                        const verificationUrl = verificationUriComplete ?? verificationUri;
                        setStates((current) => ({
                            ...current,
                            [config.editorKey]: {status: "waiting", userCode, verificationUrl}
                        }));
                        WindowParentBridge.openWindow(verificationUrl, "_blank");
                    }
                });
                if (
                    controller.signal.aborted ||
                    attemptsRef.current.get(config.editorKey) !== attempt
                )
                    return;
                await syncStorage(config, "replace");
                setAccounts((current) => ({
                    ...current,
                    [config.uuid]: {
                        signedIn: true,
                        ...(tokens.email ? {email: tokens.email} : {})
                    }
                }));
                setStates((current) => ({...current, [config.editorKey]: {status: "idle"}}));
            } catch {
                if (
                    controller.signal.aborted ||
                    attemptsRef.current.get(config.editorKey) !== attempt
                )
                    return;
                setStates((current) => ({
                    ...current,
                    [config.editorKey]: {
                        status: "error",
                        message: "Sign-in failed. Try again."
                    }
                }));
            } finally {
                if (attemptsRef.current.get(config.editorKey) === attempt)
                    controllersRef.current.delete(config.editorKey);
            }
        },
        [cancelSignIn, getDraftClient, syncStorage]
    );

    const logout = React.useCallback(
        async (config: EditableProviderConfig) => {
            if (!isOAuthProviderConfig(config)) return;
            cancelSignIn(config.editorKey);
            setStates((current) => ({
                ...current,
                [config.editorKey]: {status: "logging-out"}
            }));
            try {
                await getDraftClient(config).client.logout();
                const oauthStorage = await readStorage(getDraftClient(config).storage);
                mutationsRef.current.delete(config.uuid);
                changedProviderUuidsRef.current.add(config.uuid);
                updateConfig(config.editorKey, (current) =>
                    isOAuthProviderConfig(current) ? {...current, oauthStorage} : current
                );
                setAuthDirtyVersion((version) => version + 1);
                setAccounts((current) => ({...current, [config.uuid]: {signedIn: false}}));
                setStates((current) => ({
                    ...current,
                    [config.editorKey]: {status: "idle"}
                }));
            } catch {
                setStates((current) => ({
                    ...current,
                    [config.editorKey]: {
                        status: "error",
                        message: "Logout failed. Try again."
                    }
                }));
            }
        },
        [cancelSignIn, getDraftClient, updateConfig]
    );

    const getOAuthClient = React.useCallback(
        (config: EditableProviderConfig): AuthClient | undefined =>
            isOAuthProviderConfig(config) ? getDraftClient(config).client : undefined,
        [getDraftClient]
    );

    const captureClientChanges = React.useCallback(
        async (config: EditableProviderConfig) => {
            if (!isOAuthProviderConfig(config)) return;
            const existing = mutationsRef.current.get(config.uuid);
            await syncStorage(config, existing?.kind === "replace" ? "replace" : "compare-and-set");
        },
        [syncStorage]
    );

    const getOAuthStorageMutation = React.useCallback(
        (providerUuid: string) => mutationsRef.current.get(providerUuid),
        []
    );
    const getChangedProviderUuids = React.useCallback(
        () => [...changedProviderUuidsRef.current],
        []
    );
    const markOAuthProviderChanged = React.useCallback((providerUuid: string) => {
        changedProviderUuidsRef.current.add(providerUuid);
        setAuthDirtyVersion((version) => version + 1);
    }, []);

    React.useEffect(
        () => () => {
            for (const controller of controllersRef.current.values()) controller.abort();
            attemptsRef.current.clear();
            clientsRef.current.clear();
            mutationsRef.current.clear();
            changedProviderUuidsRef.current.clear();
        },
        []
    );

    const isAuthBusy = Object.values(states).some(
        (state) =>
            state.status === "starting" ||
            state.status === "waiting" ||
            state.status === "logging-out"
    );
    return {
        authDirty: authDirtyVersion > 0,
        isAuthBusy,
        getOAuthClient,
        captureClientChanges,
        getOAuthStorageMutation,
        getChangedProviderUuids,
        markOAuthProviderChanged,
        signIn,
        logout,
        cancelSignIn,
        openVerificationUrl: (url: string) => WindowParentBridge.openWindow(url, "_blank"),
        getSignInState: (editorKey: string): OAuthSignInState =>
            states[editorKey] ?? {status: "idle"},
        isSignedIn: (config: EditableProviderConfig): boolean =>
            config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION &&
            accounts[config.uuid]?.signedIn === true,
        getAccountEmail: (providerUuid: string): string | undefined => accounts[providerUuid]?.email
    };
}
