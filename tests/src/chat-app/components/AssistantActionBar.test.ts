import type {ThreadMessage} from "@assistant-ui/react";
import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, test, vi} from "vitest";
import {
    AssistantActionBar,
    isAssistantReloadDisabled
} from "../../../../src/chat-app/components/AssistantActionBar";
import {LogseqCommitChangesTool} from "../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";

const fixture = vi.hoisted(() => ({
    state: undefined as unknown as ReturnType<typeof createState>,
    reload: vi.fn(),
    guard: vi.fn<() => Promise<boolean>>()
}));

vi.mock("@assistant-ui/react", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
        ActionBarPrimitive: {
            Root: ({children}: {children: React.ReactNode}) => children,
            Copy: ({children}: {children: React.ReactNode}) => children
        },
        AuiIf: ({children}: {children: React.ReactNode}) => children,
        useAui: () => ({
            thread: () => ({getState: () => fixture.state.thread}),
            message: () => ({
                getState: () => fixture.state.message,
                reload: fixture.reload
            })
        }),
        useAuiState: (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state)
    };
});

vi.mock("src/chat-app/hooks/useLogseqAppliedChangesBranchGuard", () => ({
    useLogseqAppliedChangesBranchGuard: () => fixture.guard
}));

vi.mock("src/shadcn/assistant-ui/tooltip-icon-button", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
        TooltipIconButton: ({
            tooltip,
            ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
            tooltip: string;
        }) => React.createElement("button", {...props, "aria-label": tooltip})
    };
});

const mountedRoots: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
}> = [];

const committedMessages = [
    {id: "user-a", role: "user", content: [{type: "text", text: "A"}]},
    {
        id: "assistant-a",
        role: "assistant",
        content: [
            {
                type: "tool-call",
                toolCallId: "commit",
                toolName: LogseqCommitChangesTool.NAME,
                args: {},
                argsText: "{}",
                result: {success: true, outcome: "committed"}
            }
        ]
    },
    {id: "assistant-continuation", role: "assistant", content: [{type: "text", text: "A2"}]},
    {id: "user-b", role: "user", content: [{type: "text", text: "B"}]},
    {id: "assistant-b", role: "assistant", content: [{type: "text", text: "B2"}]}
] as unknown as ThreadMessage[];

function createState(messageId = "assistant-b", messages = committedMessages) {
    return {
        thread: {messages, isRunning: false, isDisabled: false},
        message: {id: messageId, role: "assistant", isCopied: false}
    };
}

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    fixture.reload.mockReset();
    fixture.guard.mockReset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderActionBar() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});
    await act(async () => root.render(createElement(AssistantActionBar)));
    return {
        copy: container.querySelector('[aria-label="Copy"]') as HTMLButtonElement,
        refresh: container.querySelector('[aria-label="Refresh"]') as HTMLButtonElement
    };
}

describe("isAssistantReloadDisabled", () => {
    test("disables refresh through the committed turn but not a later turn", () => {
        const common = {
            messages: committedMessages,
            role: "assistant",
            isReloading: false,
            isRunning: false,
            isDisabled: false
        };

        expect(isAssistantReloadDisabled({...common, messageId: "assistant-a"})).toBe(true);
        expect(isAssistantReloadDisabled({...common, messageId: "assistant-continuation"})).toBe(
            true
        );
        expect(isAssistantReloadDisabled({...common, messageId: "assistant-b"})).toBe(false);
    });

    test.each([
        ["reloading", {isReloading: true}],
        ["running", {isRunning: true}],
        ["disabled thread", {isDisabled: true}],
        ["wrong role", {role: "user"}]
    ])("preserves the %s disabled condition", (_name, override) => {
        expect(
            isAssistantReloadDisabled({
                messages: [],
                messageId: "assistant",
                role: "assistant",
                isReloading: false,
                isRunning: false,
                isDisabled: false,
                ...override
            })
        ).toBe(true);
    });
});

describe("AssistantActionBar", () => {
    test("disables committed refresh while leaving copy available", async () => {
        fixture.state = createState("assistant-a");
        const {copy, refresh} = await renderActionBar();

        expect(refresh.disabled).toBe(true);
        expect(copy.disabled).toBe(false);
    });

    test("reloads an eligible later turn once across rapid clicks", async () => {
        fixture.state = createState();
        let resolveGuard: (value: boolean) => void = () => {};
        fixture.guard.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveGuard = resolve;
            })
        );
        const {refresh} = await renderActionBar();

        refresh.click();
        refresh.click();
        expect(fixture.guard).toHaveBeenCalledOnce();
        await act(async () => resolveGuard(true));
        expect(fixture.reload).toHaveBeenCalledOnce();
    });

    test("does not reload when the target becomes committed while awaiting the guard", async () => {
        fixture.state = createState("assistant-b", committedMessages.slice(3));
        let resolveGuard: (value: boolean) => void = () => {};
        fixture.guard.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveGuard = resolve;
            })
        );
        const {refresh} = await renderActionBar();
        refresh.click();

        fixture.state = createState("assistant-a", committedMessages);
        await act(async () => resolveGuard(true));
        expect(fixture.reload).not.toHaveBeenCalled();
    });
});
