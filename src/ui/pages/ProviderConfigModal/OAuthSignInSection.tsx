import OPENAI_ICON from "@tabler/icons/outline/brand-openai.svg?raw";
import {LoaderCircle, LogOut, X} from "lucide-react";
import type React from "react";
import {LogseqButton} from "../../components/LogseqButton";
import type {OAuthSignInState} from "./types";

interface OAuthSignInSectionProps {
    providerName: string;
    signedIn: boolean;
    accountEmail?: string;
    disabled: boolean;
    state: OAuthSignInState;
    onSignIn: () => void;
    onLogout: () => void;
    onCancel: () => void;
    onOpenVerificationUrl: (url: string) => void;
    prerequisite?: string;
}

export const OAuthSignInSection: React.FC<OAuthSignInSectionProps> = ({
    providerName,
    signedIn,
    accountEmail,
    disabled,
    state,
    onSignIn,
    onLogout,
    onCancel,
    onOpenVerificationUrl,
    prerequisite
}) => {
    if (signedIn) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-md border border-green-600/40 bg-green-600/10 p-3">
                <div className="text-sm font-medium text-green-700">
                    Signed in to {providerName}
                    {accountEmail && (
                        <span className="block text-xs font-normal opacity-80">{accountEmail}</span>
                    )}
                </div>
                <LogseqButton color="outline-link" size="sm" disabled={disabled} onClick={onLogout}>
                    {state.status === "logging-out" ? (
                        <LoaderCircle
                            className="animate-spin motion-reduce:animate-none"
                            size={15}
                        />
                    ) : (
                        <LogOut size={15} />
                    )}
                    {state.status === "logging-out" ? "Logging out..." : "Logout"}
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
                <div className="text-sm opacity-80">Enter this code at the opened sign-in page</div>
                <div className="select-all font-mono text-3xl font-semibold tracking-[0.18em]">
                    {state.userCode}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm opacity-80">
                    <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} />
                    Waiting for authorization...
                </div>
                <button
                    type="button"
                    className="text-sm text-primary underline"
                    onClick={() => onOpenVerificationUrl(state.verificationUrl)}>
                    {state.verificationUrl}
                </button>
                <div className="flex justify-center">
                    <LogseqButton color="outline-link" size="sm" onClick={onCancel}>
                        <X size={15} /> Cancel sign-in
                    </LogseqButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-md border border-border p-3">
            {prerequisite && <div className="text-sm opacity-80">{prerequisite}</div>}
            {state.status === "starting" ? (
                <div role="status" aria-busy="true" className="space-y-2 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm opacity-80">
                        <LoaderCircle
                            className="animate-spin motion-reduce:animate-none"
                            size={18}
                        />
                        Requesting a device code...
                    </div>
                    <div className="flex justify-center">
                        <LogseqButton color="outline-link" size="sm" onClick={onCancel}>
                            <X size={15} /> Cancel sign-in
                        </LogseqButton>
                    </div>
                </div>
            ) : (
                <LogseqButton
                    icon={OPENAI_ICON}
                    isFullWidth
                    color="primary"
                    size="lg"
                    disabled={disabled}
                    onClick={onSignIn}>
                    Sign in with {providerName}
                </LogseqButton>
            )}
            {state.status === "error" && (
                <div role="alert" className="text-center text-sm text-red-600">
                    {state.message}
                </div>
            )}
        </div>
    );
};
