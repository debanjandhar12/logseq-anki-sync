import type {ThreadMessage} from "@assistant-ui/react";
import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, test, vi} from "vitest";
import {
    BranchPicker,
    isBranchSwitchDisabled
} from "../../../../src/chat-app/components/BranchPicker";
import {LogseqCommitChangesTool} from "../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";

const fixture = vi.hoisted(() => ({
    state: undefined as unknown as ReturnType<typeof createState>,
    switchToBranch: vi.fn(),
    guard: vi.fn<() => Promise<boolean>>()
}));

vi.mock("@assistant-ui/react", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
        BranchPickerPrimitive: {
            Root: ({children}: {children: React.ReactNode}) => children,
            Number: () => fixture.state.message.branchNumber,
            Count: () => fixture.state.message.branchCount
        },
        useAui: () => ({
            thread: () => ({getState: () => fixture.state.thread}),
            message: () => ({
                getState: () => fixture.state.message,
                switchToBranch: fixture.switchToBranch
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
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & {tooltip: string}) =>
            React.createElement("button", {...props, "aria-label": tooltip})
    };
});

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
    {id: "user-b", role: "user", content: [{type: "text", text: "B"}]},
    {id: "assistant-b", role: "assistant", content: [{type: "text", text: "B2"}]}
] as unknown as ThreadMessage[];

function createState(messageId = "assistant-b", messages = committedMessages) {
    return {
        thread: {
            messages,
            isRunning: false,
            capabilities: {switchBranchDuringRun: false}
        },
        message: {id: messageId, branchNumber: 2, branchCount: 3}
    };
}

const mountedRoots: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
}> = [];

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    fixture.switchToBranch.mockReset();
    fixture.guard.mockReset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderBranchPicker() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});
    await act(async () => root.render(createElement(BranchPicker)));
    return {
        previous: container.querySelector('[aria-label="Previous"]') as HTMLButtonElement,
        next: container.querySelector('[aria-label="Next"]') as HTMLButtonElement
    };
}

describe("isBranchSwitchDisabled", () => {
    test.each([
        "user-a",
        "assistant-a"
    ])("disables branch switching for committed %s messages", (messageId) => {
        expect(
            isBranchSwitchDisabled({
                messages: committedMessages,
                messageId,
                isSwitching: false,
                isRunning: false,
                canSwitchDuringRun: false
            })
        ).toBe(true);
    });

    test("allows branch switching for messages after the commit", () => {
        expect(
            isBranchSwitchDisabled({
                messages: committedMessages,
                messageId: "assistant-b",
                isSwitching: false,
                isRunning: false,
                canSwitchDuringRun: false
            })
        ).toBe(false);
    });
});

describe("BranchPicker", () => {
    test("disables both controls for committed user and assistant messages", async () => {
        fixture.state = createState("user-a");
        const userControls = await renderBranchPicker();
        expect(userControls.previous.disabled).toBe(true);
        expect(userControls.next.disabled).toBe(true);

        fixture.state = createState("assistant-a");
        const assistantControls = await renderBranchPicker();
        expect(assistantControls.previous.disabled).toBe(true);
        expect(assistantControls.next.disabled).toBe(true);
    });

    test("switches an eligible message only once across rapid clicks", async () => {
        fixture.state = createState();
        let resolveGuard: (value: boolean) => void = () => {};
        fixture.guard.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveGuard = resolve;
            })
        );
        const {next} = await renderBranchPicker();

        next.click();
        next.click();
        expect(fixture.guard).toHaveBeenCalledOnce();
        await act(async () => resolveGuard(true));
        expect(fixture.switchToBranch).toHaveBeenCalledOnce();
        expect(fixture.switchToBranch).toHaveBeenCalledWith({position: "next"});
    });

    test("does not switch when the target becomes committed while awaiting the guard", async () => {
        fixture.state = createState("assistant-b", committedMessages.slice(2));
        let resolveGuard: (value: boolean) => void = () => {};
        fixture.guard.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveGuard = resolve;
            })
        );
        const {previous} = await renderBranchPicker();
        previous.click();

        fixture.state = createState("assistant-a", committedMessages);
        await act(async () => resolveGuard(true));
        expect(fixture.switchToBranch).not.toHaveBeenCalled();
    });
});
