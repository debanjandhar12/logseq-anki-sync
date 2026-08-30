import OPENAI_ICON from "@tabler/icons/outline/brand-openai.svg?raw";
import {LoaderCircle, LogOut, X} from "lucide-react";
import React from "react";
import {CodexSessionManager} from "src/core/ai-sdk/codex/CodexSessionManager";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {LogseqButton} from "../../components/LogseqButton";

interface CodexSignInSectionProps {
    encodedCredentials: string;
    disabled: boolean;
    onSignedIn: (encodedCredentials: string) => void;
    onLogout: () => void;
    onBusyChange: (busy: boolean) => void;
}

type SignInState =
    | {status: "idle"}
    | {status: "starting"}
    | {status: "waiting"; userCode: string; verificationUrl: string}
    | {status: "error"; message: string};

export const CodexSignInSection: React.FC<CodexSignInSectionProps> = ({
    encodedCredentials,
    disabled,
    onSignedIn,
    onLogout,
    onBusyChange
}) => {
    const [state, setState] = React.useState<SignInState>({status: "idle"});
    const attemptRef = React.useRef(0);
    const controllerRef = React.useRef<AbortController | null>(null);
    const isBusy = state.status === "starting" || state.status === "waiting";

    React.useEffect(() => onBusyChange(isBusy), [isBusy, onBusyChange]);
    React.useEffect(
        () => () => {
            attemptRef.current += 1;
            controllerRef.current?.abort();
            onBusyChange(false);
        },
        [onBusyChange]
    );

    const cancel = React.useCallback(() => {
        attemptRef.current += 1;
        controllerRef.current?.abort();
        controllerRef.current = null;
        setState({status: "idle"});
    }, []);

    const signIn = React.useCallback(async () => {
        cancel();
        const attempt = attemptRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        setState({status: "starting"});
        let encodedResult = "";
        try {
            const session = CodexSessionManager.createDeviceLoginSession((encoded) => {
                encodedResult = encoded;
            });
            await session.auth.loginWithDeviceCode({
                signal: controller.signal,
                onVerification: async ({userCode, verificationUrl}) => {
                    if (controller.signal.aborted || attempt !== attemptRef.current) return;
                    setState({status: "waiting", userCode, verificationUrl});
                    WindowParentBridge.openWindow(verificationUrl, "_blank");
                }
            });
            if (controller.signal.aborted || attempt !== attemptRef.current) return;
            if (!encodedResult) throw new Error("Codex sign-in did not return credentials");
            onSignedIn(encodedResult);
            setState({status: "idle"});
        } catch (error) {
            if (controller.signal.aborted || attempt !== attemptRef.current) return;
            const code =
                typeof error === "object" && error !== null && "code" in error
                    ? String(error.code)
                    : "";
            setState({
                status: "error",
                message:
                    code === "device_authorization_timeout"
                        ? "Codex sign-in expired. Start sign-in again."
                        : "Codex sign-in failed. Try again."
            });
        } finally {
            if (attempt === attemptRef.current) controllerRef.current = null;
        }
    }, [cancel, onSignedIn]);

    if (encodedCredentials) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-md border border-green-600/40 bg-green-600/10 p-3">
                <div className="text-sm font-medium text-green-700">
                    Signed in to Codex Subscription
                </div>
                <LogseqButton color="outline-link" size="sm" disabled={disabled} onClick={onLogout}>
                    <LogOut size={15} /> Logout
                </LogseqButton>
            </div>
        );
    }

    if (state.status === "waiting") {
        return (
            <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="space-y-3 rounded-md border border-border bg-secondary-background p-4 text-center">
                <div className="text-sm opacity-80">Enter this code at the opened ChatGPT page</div>
                <div className="select-all font-mono text-3xl font-semibold tracking-[0.18em]">
                    {state.userCode}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm opacity-80">
                    <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
                    Waiting for authorization...
                </div>
                <a
                    className="block text-sm text-primary underline"
                    href={state.verificationUrl}
                    target="_blank"
                    rel="noreferrer">
                    {state.verificationUrl}
                </a>
                <div className="flex justify-center">
                    <LogseqButton color="outline-link" size="sm" onClick={cancel}>
                        <X size={15} /> Cancel sign-in
                    </LogseqButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-border p-3">
            <LogseqButton
                icon={OPENAI_ICON}
                isFullWidth
                color="primary"
                size="lg"
                disabled={disabled || state.status === "starting"}
                onClick={signIn}>
                {state.status === "starting"
                    ? "Starting Codex sign-in..."
                    : "Sign in with Codex Subscription"}
            </LogseqButton>
            {state.status === "starting" && (
                <div role="status" className="text-center text-sm opacity-80">
                    Requesting a device code...
                </div>
            )}
            {state.status === "error" && (
                <div role="alert" className="text-center text-sm text-red-600">
                    {state.message}
                </div>
            )}
        </div>
    );
};
