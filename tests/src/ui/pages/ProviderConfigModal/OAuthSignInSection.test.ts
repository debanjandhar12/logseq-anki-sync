import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {OAuthSignInSection} from "../../../../../src/ui/pages/ProviderConfigModal/OAuthSignInSection";

describe("OAuthSignInSection", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    test("shows device authorization state and delegates its actions", async () => {
        const onCancel = vi.fn();
        const onOpenVerificationUrl = vi.fn();
        await act(async () => {
            root.render(
                React.createElement(OAuthSignInSection, {
                    providerName: "Codex Subscription",
                    signedIn: false,
                    disabled: false,
                    state: {
                        status: "waiting",
                        userCode: "ABCD-EFGH",
                        verificationUrl: "https://auth.openai.com/codex/device"
                    },
                    onSignIn: vi.fn(),
                    onLogout: vi.fn(),
                    onCancel,
                    onOpenVerificationUrl
                })
            );
        });

        expect(container.textContent).toContain("ABCD-EFGH");
        expect(container.textContent).toContain("Waiting for authorization");
        const buttons = container.querySelectorAll("button");
        act(() => buttons[0]?.click());
        expect(onOpenVerificationUrl).toHaveBeenCalledWith("https://auth.openai.com/codex/device");
        act(() => buttons[1]?.click());
        expect(onCancel).toHaveBeenCalledOnce();
    });

    test("renders signed-in status and delegates logout", async () => {
        const onLogout = vi.fn();
        await act(async () => {
            root.render(
                React.createElement(OAuthSignInSection, {
                    providerName: "Codex Subscription",
                    signedIn: true,
                    accountEmail: "user@example.com",
                    disabled: false,
                    state: {status: "idle"},
                    onSignIn: vi.fn(),
                    onLogout,
                    onCancel: vi.fn(),
                    onOpenVerificationUrl: vi.fn()
                })
            );
        });

        expect(container.textContent).toContain("Signed in to Codex Subscription");
        expect(container.textContent).toContain("user@example.com");
        act(() => container.querySelector("button")?.click());
        expect(onLogout).toHaveBeenCalledOnce();
    });
});
