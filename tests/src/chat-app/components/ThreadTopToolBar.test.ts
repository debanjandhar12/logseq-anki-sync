import type {ThreadMessage} from "@assistant-ui/react";
import {act, createElement, type ReactNode} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, describe, expect, test, vi} from "vitest";
import {
    isThreadPageExportEnabled,
    ThreadTopToolBar,
    ThreadTopToolBarMore
} from "../../../../src/chat-app/components/ThreadTopToolBar";

const fixture = vi.hoisted(() => ({
    state: undefined as unknown as ReturnType<typeof createState>,
    exportThread: vi.fn(),
    showMsg: vi.fn()
}));

vi.mock("@assistant-ui/react", async () => {
    const actual =
        await vi.importActual<typeof import("@assistant-ui/react")>("@assistant-ui/react");
    return {
        ...actual,
        ThreadListPrimitive: {
            ...actual.ThreadListPrimitive,
            New: ({children}: {children: ReactNode}) => children
        },
        useAuiState: (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state)
    };
});

vi.mock("@assistant-ui/react-ai-sdk", () => ({
    getThreadMessageTokenUsage: () => undefined
}));

vi.mock("../../../../src/chat-app/export/ChatPageExporter", () => ({
    ChatPageExporter: {exportThread: fixture.exportThread}
}));

vi.mock("../../../../src/chat-app/components/ReviewChangesDisplay", () => ({
    ReviewChangesDisplay: () => null
}));

vi.mock("../../../../src/shadcn/assistant-ui/tooltip-icon-button", () => ({
    TooltipIconButton: ({
        children,
        tooltip,
        ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {tooltip: string}) =>
        createElement("button", {...props, type: "button", "aria-label": tooltip}, children)
}));

const mountedRoots: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
}> = [];

function createState(messages: ThreadMessage[] = []) {
    return {
        thread: {messages},
        threadListItem: {remoteId: "thread-1", title: "Saved title", status: "regular"}
    };
}

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    fixture.exportThread.mockReset();
    fixture.showMsg.mockReset();
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe("ThreadTopToolBar", () => {
    test.each([
        ["new", undefined, 0, false, false],
        ["new", "thread-1", 1, false, false],
        ["regular", undefined, 1, false, false],
        ["regular", "thread-1", 0, false, false],
        ["regular", "thread-1", 1, false, true],
        ["regular", "thread-1", 1, true, false],
        ["deleted", "thread-1", 1, false, false]
    ])("checks status=%s, id=%s, messages=%i, busy=%s", (status, threadId, messageCount, isBusy, expected) => {
        expect(
            isThreadPageExportEnabled(status as string, threadId as string, messageCount, isBusy)
        ).toBe(expected);
    });

    test("closes the non-modal more menu after an outside pointer interaction", async () => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement("div");
        const outside = document.createElement("button");
        document.body.append(container, outside);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                createElement(ThreadTopToolBarMore, {
                    onOpenDevTools: vi.fn(),
                    onExportAsPage: vi.fn(),
                    isPageExportDisabled: false
                })
            );
        });

        const trigger = container.querySelector("button");
        expect(trigger).not.toBeNull();
        await act(async () => {
            trigger?.dispatchEvent(
                new MouseEvent("pointerdown", {bubbles: true, button: 0, ctrlKey: false})
            );
        });
        expect(document.body.textContent).toContain("Export as Page");

        await new Promise((resolve) => setTimeout(resolve, 0));
        await act(async () => {
            outside.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true}));
        });
        expect(document.body.textContent).not.toContain("Export as Page");

        await act(async () => {
            root.unmount();
        });
        container.remove();
        outside.remove();
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    });

    test("delegates export and shows the canonical page name", async () => {
        const messages = [createUserMessage()];
        fixture.state = createState(messages);
        fixture.exportThread.mockResolvedValue({pageName: "_chat_export_thread-1_Saved title"});
        fixture.showMsg.mockResolvedValue(undefined);
        vi.stubGlobal("logseq", {UI: {showMsg: fixture.showMsg}});
        const container = await renderToolbar();

        await openExportMenu(container);
        const exportItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
            (element) => element.textContent === "Export as Page"
        );
        expect(exportItem).toBeDefined();
        await act(async () => {
            exportItem?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });

        expect(fixture.exportThread).toHaveBeenCalledWith({
            threadId: "thread-1",
            threadTitle: "Saved title",
            messages: expect.any(Array)
        });
        expect(fixture.exportThread.mock.calls[0][0].messages).toEqual(messages);
        expect(fixture.exportThread.mock.calls[0][0].messages).not.toBe(messages);
        expect(fixture.showMsg).toHaveBeenCalledWith(
            "Chat exported to page: _chat_export_thread-1_Saved title",
            "success"
        );
    });

    test("shows generic feedback when the exporter rejects", async () => {
        fixture.state = createState([createUserMessage()]);
        fixture.exportThread.mockRejectedValue(new Error("export failed"));
        fixture.showMsg.mockResolvedValue(undefined);
        vi.stubGlobal("logseq", {UI: {showMsg: fixture.showMsg}});
        const container = await renderToolbar();

        await openExportMenu(container);
        const exportItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
            (element) => element.textContent === "Export as Page"
        );
        await act(async () => {
            exportItem?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });

        expect(fixture.showMsg).toHaveBeenCalledWith("Failed to export chat as page", "error");
    });

    test("prevents duplicate exports and recovers after pending work completes", async () => {
        fixture.state = createState([createUserMessage()]);
        const exportResult = Promise.withResolvers<{pageName: string}>();
        fixture.exportThread.mockReturnValue(exportResult.promise);
        fixture.showMsg.mockResolvedValue(undefined);
        vi.stubGlobal("logseq", {UI: {showMsg: fixture.showMsg}});
        const container = await renderToolbar();

        await openExportMenu(container);
        await act(async () => {
            getExportMenuItem()?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });
        expect(fixture.exportThread).toHaveBeenCalledOnce();

        await openExportMenu(container);
        const pendingExportItem = getExportMenuItem();
        expect(pendingExportItem?.getAttribute("data-disabled")).not.toBeNull();
        await act(async () => {
            pendingExportItem?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        });
        expect(fixture.exportThread).toHaveBeenCalledOnce();

        await act(async () => {
            exportResult.resolve({pageName: "_chat_export_thread-1"});
            await exportResult.promise;
        });
        expect(getExportMenuItem()?.getAttribute("data-disabled")).toBeNull();
    });
});

async function renderToolbar(): Promise<HTMLDivElement> {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});
    await act(async () => {
        root.render(
            createElement(ThreadTopToolBar, {
                isHistoryVisible: false,
                onBackToThread: vi.fn(),
                onShowHistory: vi.fn()
            })
        );
    });
    return container;
}

async function openExportMenu(container: HTMLDivElement): Promise<void> {
    const trigger = container.querySelector("button");
    await act(async () => {
        trigger?.dispatchEvent(
            new MouseEvent("pointerdown", {bubbles: true, button: 0, ctrlKey: false})
        );
    });
}

function getExportMenuItem(): Element | undefined {
    return Array.from(document.querySelectorAll('[role="menuitem"]')).find(
        (element) => element.textContent === "Export as Page"
    );
}

function createUserMessage(): ThreadMessage {
    return {
        id: "user-1",
        role: "user",
        createdAt: new Date(),
        content: [{type: "text", text: "Question"}],
        attachments: [],
        metadata: {custom: {}}
    };
}
