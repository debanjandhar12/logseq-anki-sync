import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {CodexSignInSection} from "../../../../../src/ui/pages/ProviderConfigModal/CodexSignInSection";

const mocks = vi.hoisted(() => ({
    loginWithDeviceCode: vi.fn(),
    openWindow: vi.fn()
}));

vi.mock("src/core/ai-sdk/codex/CodexSessionManager", () => ({
    CodexSessionManager: {
        createDeviceLoginSession: vi.fn((onSave: (encoded: string) => void) => ({
            auth: {
                loginWithDeviceCode: async (options: {
                    onVerification: (authorization: {
                        userCode: string;
                        verificationUrl: string;
                    }) => Promise<void>;
                    signal: AbortSignal;
                }) => {
                    await mocks.loginWithDeviceCode(options);
                    onSave("encoded-secret");
                }
            }
        }))
    }
}));

vi.mock("src/logseq/WindowParentBridge", () => ({
    WindowParentBridge: {openWindow: mocks.openWindow}
}));

describe("CodexSignInSection", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
        vi.clearAllMocks();
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    test("shows the code while polling and completes without a Complete button", async () => {
        let finishLogin: (() => void) | undefined;
        mocks.loginWithDeviceCode.mockImplementation(
            async ({onVerification}: {onVerification: (value: unknown) => Promise<void>}) => {
                await onVerification({
                    userCode: "ABCD-EFGH",
                    verificationUrl: "https://auth.openai.com/codex/device"
                });
                await new Promise<void>((resolve) => {
                    finishLogin = resolve;
                });
            }
        );
        const onSignedIn = vi.fn();
        await act(async () => {
            root.render(
                React.createElement(CodexSignInSection, {
                    encodedCredentials: "",
                    disabled: false,
                    onSignedIn,
                    onLogout: vi.fn(),
                    onBusyChange: vi.fn()
                })
            );
        });

        await act(async () => {
            container.querySelector("button")?.click();
            await Promise.resolve();
        });
        expect(container.textContent).toContain("ABCD-EFGH");
        expect(container.textContent).toContain("Waiting for authorization");
        expect(container.textContent).not.toContain("Complete sign-in");
        expect(mocks.openWindow).toHaveBeenCalledWith(
            "https://auth.openai.com/codex/device",
            "_blank"
        );

        await act(async () => {
            finishLogin?.();
            await Promise.resolve();
        });
        expect(onSignedIn).toHaveBeenCalledWith("encoded-secret");
        expect(container.textContent).not.toContain("encoded-secret");
    });

    test("renders signed-in status and logs out through the draft callback", async () => {
        const onLogout = vi.fn();
        await act(async () => {
            root.render(
                React.createElement(CodexSignInSection, {
                    encodedCredentials: "encoded-secret",
                    disabled: false,
                    onSignedIn: vi.fn(),
                    onLogout,
                    onBusyChange: vi.fn()
                })
            );
        });

        expect(container.textContent).toContain("Signed in to Codex Subscription");
        expect(container.textContent).not.toContain("encoded-secret");
        act(() => container.querySelector("button")?.click());
        expect(onLogout).toHaveBeenCalledOnce();
    });
});
