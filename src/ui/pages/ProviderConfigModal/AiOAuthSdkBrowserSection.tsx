import "@logseq/libs";
import {
    type AuthStorage,
    autoLogin,
    currentBrowserOrigin,
    type DeviceCodeResponse,
    resolveBrowserFlow
} from "@ai-oauth-sdk/browser";
import React from "react";
import {createLogger} from "../../../logger";
import {LoggerCategory} from "../../../logger/types";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqSelect} from "../../components/LogseqSelect";
import {getErrorMessage} from "../SkillEditorModal/utils/getErrorMessage";
import {
    type BrowserOAuthStorageMode,
    createBrowserOAuthStorage,
    createMemoryOAuthStorage,
    createOpenAIBrowserOAuthClient,
    loginWithOpenAIPopup,
    openai,
    type SafeDevicePrompt,
    summarizeBrowserOAuthTokens,
    toSafeDevicePrompt
} from "./aiOAuthSdkBrowserFlow";

const logger = createLogger(LoggerCategory.OTHER_UI);
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

type LoginApproach = "direct" | "auto" | "popup";

function summarize(value: unknown): string {
    return JSON.stringify(value, (_key, item) =>
        typeof item === "string" && item.length > 64
            ? `${item.slice(0, 24)}...(${item.length} chars)`
            : item
    );
}

async function notify(title: string, value: unknown): Promise<void> {
    const summary = summarize(value);
    logger.info(`${title}: ${summary}`);
    await logseq.UI.showMsg(`${title}: ${summary}`, "success", {timeout: 20000});
}

export const AiOAuthSdkBrowserSection: React.FC = () => {
    const [storageMode, setStorageMode] = React.useState<BrowserOAuthStorageMode>("session");
    const [busyApproach, setBusyApproach] = React.useState<LoginApproach | null>(null);
    const [devicePrompt, setDevicePrompt] = React.useState<SafeDevicePrompt | null>(null);
    const [memoryStorage] = React.useState(createMemoryOAuthStorage);
    const activeController = React.useRef<AbortController | null>(null);

    const cancelLogin = React.useCallback(() => {
        activeController.current?.abort();
    }, []);

    React.useEffect(() => cancelLogin, [cancelLogin]);

    const getStorage = React.useCallback(
        (): AuthStorage => createBrowserOAuthStorage(storageMode, memoryStorage),
        [memoryStorage, storageMode]
    );

    const handleResolveFlow = React.useCallback(() => {
        const origin = currentBrowserOrigin();
        const resolution = resolveBrowserFlow(openai, origin);
        void notify("Browser SDK flow resolution", {origin, resolution});
    }, []);

    const runLogin = React.useCallback(
        async (approach: LoginApproach) => {
            if (activeController.current) return;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort("timeout"), LOGIN_TIMEOUT_MS);
            activeController.current = controller;
            setBusyApproach(approach);
            setDevicePrompt(null);

            try {
                const storage = getStorage();
                const client = createOpenAIBrowserOAuthClient(storage);
                const onCode = async (device: DeviceCodeResponse) => {
                    const prompt = toSafeDevicePrompt(device);
                    setDevicePrompt(prompt);
                    await notify("Browser SDK device authorization started", prompt);
                };
                const tokens =
                    approach === "direct"
                        ? await client.deviceLogin({signal: controller.signal, onCode})
                        : approach === "auto"
                          ? await autoLogin(client, {signal: controller.signal, onCode})
                          : await loginWithOpenAIPopup(storage, {
                                signal: controller.signal,
                                timeoutMs: LOGIN_TIMEOUT_MS
                            });
                await notify(
                    approach === "direct"
                        ? "Browser SDK deviceLogin credentials"
                        : approach === "auto"
                          ? "Browser SDK autoLogin credentials"
                          : "Browser SDK forced popup credentials",
                    summarizeBrowserOAuthTokens(tokens)
                );
            } catch (error) {
                if (controller.signal.aborted) {
                    const timedOut = controller.signal.reason === "timeout";
                    await logseq.UI.showMsg(
                        timedOut ? "Browser SDK login timed out." : "Browser SDK login cancelled.",
                        "warning"
                    );
                } else {
                    const message = getErrorMessage(error);
                    logger.error("Browser SDK sign-in failed", error);
                    await logseq.UI.showMsg(`Browser SDK sign-in failed: ${message}`, "error", {
                        timeout: 15000
                    });
                }
            } finally {
                clearTimeout(timeoutId);
                if (activeController.current === controller) activeController.current = null;
                setBusyApproach(null);
            }
        },
        [getStorage]
    );

    const handleOpenVerification = React.useCallback(() => {
        if (!devicePrompt) return;
        const opened = WindowParentBridge.openWindow(
            devicePrompt.verificationUriComplete ?? devicePrompt.verificationUri
        );
        if (!opened) void logseq.UI.showMsg("The verification page was blocked.", "warning");
    }, [devicePrompt]);

    const handleClearSession = React.useCallback(() => {
        void (async () => {
            try {
                const client = createOpenAIBrowserOAuthClient(getStorage());
                await client.logout();
                await logseq.UI.showMsg("Browser SDK stored credentials cleared.", "success");
            } catch (error) {
                await logseq.UI.showMsg(
                    `Failed to clear Browser SDK credentials: ${getErrorMessage(error)}`,
                    "error"
                );
            }
        })();
    }, [getStorage]);

    const isBusy = busyApproach !== null;

    return (
        <div className="space-y-3 rounded-md border border-border p-3">
            <div>
                <div className="text-sm font-medium">@ai-oauth-sdk/browser experiments</div>
                <p className="mt-1 text-xs opacity-70">
                    OpenAI should resolve to device flow in Logseq. Enable device code authorization
                    under ChatGPT Settings, Security before testing.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">Credential storage</span>
                <LogseqSelect
                    value={storageMode}
                    size="sm"
                    width="10rem"
                    disabled={isBusy}
                    options={[
                        {value: "session", label: "Session"},
                        {value: "local", label: "Local (persistent)"},
                        {value: "memory", label: "Memory only"}
                    ]}
                    onChange={(value) => setStorageMode(value as BrowserOAuthStorageMode)}
                />
                <LogseqButton
                    color="outline-link"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleClearSession}>
                    Clear stored credentials
                </LogseqButton>
            </div>
            {storageMode === "local" && (
                <p className="text-xs opacity-70">
                    Local storage keeps bearer credentials across plugin reloads. Clear them after
                    testing.
                </p>
            )}

            <div className="flex flex-wrap items-center">
                <LogseqButton
                    color="outline-link"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleResolveFlow}>
                    Resolve browser flow
                </LogseqButton>
                <LogseqButton
                    color="outline-link"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void runLogin("direct")}>
                    {busyApproach === "direct" ? "Waiting for sign-in..." : "Direct deviceLogin"}
                </LogseqButton>
                <LogseqButton
                    color="outline-link"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void runLogin("auto")}>
                    {busyApproach === "auto" ? "Waiting for sign-in..." : "Flow-aware autoLogin"}
                </LogseqButton>
                <LogseqButton
                    color="outline-link"
                    size="sm"
                    disabled={isBusy}
                    title="Forces OpenAI's localhost:1455 callback; expected to fail without a listener"
                    onClick={() => void runLogin("popup")}>
                    {busyApproach === "popup"
                        ? "Waiting for popup..."
                        : "Force popup (expected fail)"}
                </LogseqButton>
                {isBusy && (
                    <LogseqButton color="failed" size="sm" onClick={cancelLogin}>
                        Cancel login
                    </LogseqButton>
                )}
            </div>

            <p className="text-xs opacity-70">
                Forced popup bypasses flow selection and targets localhost:1455. It only completes
                if that callback is being served and can return the result to this window.
            </p>

            {devicePrompt && (
                <div className="space-y-1 rounded border border-border p-2 text-xs">
                    <div>
                        Enter code{" "}
                        <span className="font-mono font-medium">{devicePrompt.userCode}</span>
                    </div>
                    <div>Expires: {new Date(devicePrompt.expiresAt).toLocaleTimeString()}</div>
                    <LogseqButton color="primary" size="sm" onClick={handleOpenVerification}>
                        Open verification page
                    </LogseqButton>
                </div>
            )}
        </div>
    );
};
