import "@logseq/libs";
import {completeLogin, getSession, startLogin} from "@openai-oauth/web";
import {OpenAIOAuth} from "openai-oauth-ai-provider/core";
import React from "react";
import {createLogger} from "../../../logger";
import {LoggerCategory} from "../../../logger/types";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {MemoryTokenStore} from "../../../shims/openaiOauthTokenStoreShim";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqInput} from "../../components/LogseqInput";
import {getErrorMessage} from "../SkillEditorModal/utils/getErrorMessage";

const logger = createLogger(LoggerCategory.OTHER_UI);

const OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CALLBACK_URL = "http://localhost:1455/auth/callback";

/**
 * Truncates long credential fields so the notification stays readable.
 */
function summarizeCredentials(value: unknown): string {
    const seen = new WeakSet();
    const redacted = JSON.parse(
        JSON.stringify(value, (_key, item) => {
            if (typeof item === "string" && item.length > 64) {
                return `${item.slice(0, 24)}...(${item.length} chars)`;
            }
            if (typeof item === "object" && item !== null) {
                if (seen.has(item)) return "[circular]";
                seen.add(item);
            }
            return item;
        })
    );
    return JSON.stringify(redacted);
}

async function showCredentials(title: string, credentials: unknown): Promise<void> {
    const summary = summarizeCredentials(credentials);
    logger.info(`${title}: ${summary}`);
    await logseq.UI.showMsg(`${title}: ${summary}`, "success", {timeout: 20000});
}

async function showError(title: string, error: unknown): Promise<void> {
    const message = getErrorMessage(error);
    logger.error(title, error);
    await logseq.UI.showMsg(`${title}: ${message}`, "error", {timeout: 15000});
}

/**
 * Experimental Codex (ChatGPT OAuth) sign-in approaches.
 * Each button tries a different flow and shows the returned credentials via logseq.UI.showMsg.
 * Approach 1 (device code) is the only one expected to fully work inside the sandboxed plugin
 * iframe; the other two exist to observe how the OAuth web SDK behaves in this environment.
 */
export const CodexSignInSection: React.FC = () => {
    const [busyAction, setBusyAction] = React.useState<string | null>(null);
    const [deviceAuth, setDeviceAuth] = React.useState<{
        auth: OpenAIOAuth;
        authorization: Awaited<ReturnType<OpenAIOAuth["startDeviceAuthorization"]>>;
        userCode: string;
        verificationUrl: string;
    } | null>(null);
    const [callbackUrl, setCallbackUrl] = React.useState("");

    const run = React.useCallback(async (action: string, fn: () => Promise<void>) => {
        setBusyAction(action);
        try {
            await fn();
        } finally {
            setBusyAction(null);
        }
    }, []);

    // Approach 1: Device code flow (no loopback server or browser extension required).
    const handleDeviceStart = React.useCallback(() => {
        void run("device-start", async () => {
            try {
                const auth = new OpenAIOAuth({tokenStore: new MemoryTokenStore()});
                const authorization = await auth.startDeviceAuthorization();
                WindowParentBridge.openWindow(authorization.verificationUrl);
                setDeviceAuth({
                    auth,
                    authorization,
                    userCode: authorization.userCode,
                    verificationUrl: authorization.verificationUrl
                });
                await showCredentials("Device authorization started", {
                    userCode: authorization.userCode,
                    verificationUrl: authorization.verificationUrl,
                    expiresAt: new Date(authorization.expiresAt).toISOString()
                });
            } catch (error) {
                await showError("Device authorization failed", error);
            }
        });
    }, [run]);

    const handleDeviceComplete = React.useCallback(() => {
        void run("device-complete", async () => {
            try {
                if (!deviceAuth) {
                    await logseq.UI.showMsg("Start device sign-in first.", "warning");
                    return;
                }
                // completeDeviceAuthorization must be called on the same client instance
                // that created the authorization (tracked internally via a WeakMap).
                const tokens = await deviceAuth.auth.completeDeviceAuthorization(
                    deviceAuth.authorization
                );
                setDeviceAuth(null);
                await showCredentials("Device sign-in credentials", tokens);
            } catch (error) {
                await showError("Device sign-in failed", error);
            }
        });
    }, [deviceAuth, run]);

    // Approach 2: Loopback redirect flow via @openai-oauth/core.
    // Expected to fail at the callback step (no localhost listener exists in the plugin),
    // but the authorization URL itself can be inspected.
    const handleLoopback = React.useCallback(() => {
        void run("loopback", async () => {
            try {
                const {createOpenAIOAuthRequest} = await import("@openai-oauth/core");
                const request = await createOpenAIOAuthRequest({
                    clientId: OAUTH_CLIENT_ID,
                    redirectUri: CALLBACK_URL
                });
                WindowParentBridge.openWindow(request.authorizationUrl);
                await showCredentials(
                    "Loopback OAuth request created (callback cannot be received)",
                    {
                        authorizationUrl: request.authorizationUrl,
                        redirectUri: request.redirectUri,
                        state: request.state,
                        codeVerifier: request.codeVerifier
                    }
                );
            } catch (error) {
                await showError("Loopback flow failed", error);
            }
        });
    }, [run]);

    // Approach 3: @openai-oauth/web SDK.
    // startLogin returns "needs-extension" when the Sign in with ChatGPT browser extension
    // is not installed, or opens a popup when a custom redirectUri is provided.
    // completeLogin exchanges a pasted callback URL for a session.
    const handleWebStart = React.useCallback(() => {
        void run("web-start", async () => {
            try {
                const result = await startLogin({openMode: "popup"});
                if (result.status === "needs-extension") {
                    WindowParentBridge.openWindow(result.installUrl);
                }
                await showCredentials("startLogin result", result);
            } catch (error) {
                await showError("startLogin failed", error);
            }
        });
    }, [run]);

    const handleWebComplete = React.useCallback(() => {
        void run("web-complete", async () => {
            try {
                const url = callbackUrl.trim();
                if (!url) {
                    await logseq.UI.showMsg("Paste the callback URL first.", "warning");
                    return;
                }
                const session = await completeLogin({url});
                await showCredentials("completeLogin session", session ?? {status: "no callback"});
            } catch (error) {
                await showError("completeLogin failed", error);
            }
        });
    }, [callbackUrl, run]);

    const handleWebSession = React.useCallback(() => {
        void run("web-session", async () => {
            try {
                const session = await getSession();
                await showCredentials("getSession", session ?? {status: "no session"});
            } catch (error) {
                await showError("getSession failed", error);
            }
        });
    }, [run]);

    return (
        <div className="space-y-3 rounded-md border border-border p-3">
            <div>
                <div className="text-sm font-medium">Sign in with ChatGPT (experimental)</div>
                <p className="mt-1 text-xs opacity-70">
                    Try the different OAuth approaches below. Returned credentials are shown in a
                    notification. Only the device code flow is expected to complete inside Logseq;
                    the others are included to observe SDK behavior.
                </p>
            </div>

            <div className="space-y-1">
                <div className="text-xs font-medium opacity-80">1. Device code flow</div>
                <div className="flex flex-wrap items-center">
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={handleDeviceStart}>
                        {busyAction === "device-start" ? "Starting..." : "Start device sign-in"}
                    </LogseqButton>
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null || deviceAuth === null}
                        onClick={handleDeviceComplete}>
                        {busyAction === "device-complete" ? "Completing..." : "Complete sign-in"}
                    </LogseqButton>
                </div>
                {deviceAuth && (
                    <p className="text-xs opacity-70">
                        Enter code{" "}
                        <span className="font-mono font-medium">{deviceAuth.userCode}</span> at{" "}
                        {deviceAuth.verificationUrl}, then press Complete sign-in.
                    </p>
                )}
            </div>

            <div className="space-y-1">
                <div className="text-xs font-medium opacity-80">2. Loopback redirect flow</div>
                <div className="flex flex-wrap items-center">
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={handleLoopback}>
                        {busyAction === "loopback" ? "Creating..." : "Open loopback auth URL"}
                    </LogseqButton>
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-xs font-medium opacity-80">3. Web SDK (extension / popup)</div>
                <div className="flex flex-wrap items-center">
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={handleWebStart}>
                        {busyAction === "web-start" ? "Starting..." : "startLogin (popup)"}
                    </LogseqButton>
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={handleWebSession}>
                        {busyAction === "web-session" ? "Reading..." : "getSession"}
                    </LogseqButton>
                </div>
                <div className="flex items-center gap-2">
                    <LogseqInput
                        value={callbackUrl}
                        disabled={busyAction !== null}
                        placeholder="Paste callback URL (?code=...&state=...)"
                        onChange={(event) => setCallbackUrl(event.target.value)}
                    />
                    <LogseqButton
                        color="outline-link"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={handleWebComplete}>
                        {busyAction === "web-complete" ? "Completing..." : "completeLogin"}
                    </LogseqButton>
                </div>
            </div>
        </div>
    );
};
