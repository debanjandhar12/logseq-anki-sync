import type {ThreadMessage} from "@assistant-ui/react";
import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, test, vi} from "vitest";
import {isUserEditDisabled, UserActionBar} from "../../../../src/chat-app/components/UserActionBar";
import {LogseqCommitChangesTool} from "../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";

const fixture = vi.hoisted(() => ({
    state: undefined as unknown as ReturnType<typeof createState>,
    beginEdit: vi.fn()
}));

vi.mock("@assistant-ui/react", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
        ActionBarPrimitive: {
            Root: ({children}: {children: React.ReactNode}) => children
        },
        useAui: () => ({
            thread: () => ({getState: () => fixture.state.thread}),
            message: () => ({
                getState: () => fixture.state.message,
                composer: () => ({
                    getState: () => fixture.state.message.composer,
                    beginEdit: fixture.beginEdit
                })
            })
        }),
        useAuiState: (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state)
    };
});

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
    {id: "user-b", role: "user", content: [{type: "text", text: "B"}]}
] as unknown as ThreadMessage[];

function createState(messageId = "user-b", messages = committedMessages) {
    const message = {
        id: messageId,
        role: "user",
        composer: {isEditing: false}
    };
    return {
        thread: {messages, isRunning: false, isDisabled: false},
        message
    };
}

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    fixture.beginEdit.mockReset();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderActionBar() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});
    await act(async () => root.render(createElement(UserActionBar)));
    return container.querySelector("button") as HTMLButtonElement;
}

describe("isUserEditDisabled", () => {
    test("disables edit in committed history but not a later turn", () => {
        const common = {
            messages: committedMessages,
            role: "user",
            isEditing: false,
            isRunning: false,
            isDisabled: false
        };

        expect(isUserEditDisabled({...common, messageId: "user-a"})).toBe(true);
        expect(isUserEditDisabled({...common, messageId: "user-b"})).toBe(false);
    });

    test.each([
        ["editing", {isEditing: true}],
        ["running", {isRunning: true}],
        ["disabled thread", {isDisabled: true}],
        ["wrong role", {role: "assistant"}]
    ])("preserves the %s disabled condition", (_name, override) => {
        expect(
            isUserEditDisabled({
                messages: [],
                messageId: "user",
                role: "user",
                isEditing: false,
                isRunning: false,
                isDisabled: false,
                ...override
            })
        ).toBe(true);
    });
});

describe("UserActionBar", () => {
    test("disables committed-history edits and allows a later turn", async () => {
        fixture.state = createState("user-a");
        const committedButton = await renderActionBar();
        expect(committedButton.disabled).toBe(true);

        fixture.state = createState("user-b");
        const laterButton = await renderActionBar();
        expect(laterButton.disabled).toBe(false);
        laterButton.click();
        expect(fixture.beginEdit).toHaveBeenCalledOnce();
    });

    test("rejects a commit that arrives after render", async () => {
        fixture.state = createState("user-b", committedMessages.slice(2));
        const button = await renderActionBar();
        expect(button.disabled).toBe(false);

        fixture.state.thread.messages = committedMessages;
        fixture.state.message.id = "user-a";
        button.click();
        expect(fixture.beginEdit).not.toHaveBeenCalled();
    });
});
