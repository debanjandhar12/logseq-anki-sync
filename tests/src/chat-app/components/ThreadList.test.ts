import {act, createElement, type ReactNode} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {ThreadList} from "../../../../src/chat-app/components/ThreadList";

const fixture = vi.hoisted(() => {
    const runtimeSubscribers = new Set<() => void>();
    const threadListSubscribers = new Set<() => void>();
    return {
        threadId: "thread-1",
        title: "Saved title" as string | undefined,
        isRunning: false,
        runtimeAvailable: true,
        getById: vi.fn(),
        runtimeSubscribers,
        threadListSubscribers,
        runtimeUnsubscribe: vi.fn(),
        threadListUnsubscribe: vi.fn()
    };
});

vi.mock("@assistant-ui/react", async () => {
    const passthrough = ({children, ...props}: {children?: ReactNode}) =>
        createElement("div", props, children);
    const title = ({fallback}: {fallback?: ReactNode}) => fixture.title || fallback;
    const threadRuntime = {
        getState: () => {
            if (!fixture.runtimeAvailable) throw new Error("Runtime unavailable");
            return {isRunning: fixture.isRunning};
        },
        subscribe: (callback: () => void) => {
            if (!fixture.runtimeAvailable) throw new Error("Runtime unavailable");
            fixture.runtimeSubscribers.add(callback);
            return () => {
                fixture.runtimeSubscribers.delete(callback);
                fixture.runtimeUnsubscribe();
            };
        }
    };
    const assistantRuntime = {
        threads: {
            getById: (threadId: string) => {
                fixture.getById(threadId);
                if (!fixture.runtimeAvailable) throw new Error("Runtime unavailable");
                return threadRuntime;
            },
            subscribe: (callback: () => void) => {
                fixture.threadListSubscribers.add(callback);
                return () => {
                    fixture.threadListSubscribers.delete(callback);
                    fixture.threadListUnsubscribe();
                };
            }
        }
    };

    return {
        AuiIf: ({children}: {children?: ReactNode}) => children,
        ThreadListItemMorePrimitive: {
            Root: passthrough,
            Trigger: passthrough,
            Content: passthrough,
            Item: passthrough
        },
        ThreadListItemPrimitive: {
            Root: passthrough,
            Trigger: passthrough,
            Title: title,
            Delete: passthrough
        },
        ThreadListPrimitive: {
            Root: passthrough,
            Items: ({children}: {children: () => ReactNode}) => children()
        },
        useAssistantRuntime: () => assistantRuntime,
        useAui: () => ({threads: () => ({item: () => ({rename: vi.fn()})})}),
        useAuiState: (selector: (state: unknown) => unknown) =>
            selector({
                threadListItem: {
                    id: fixture.threadId,
                    title: fixture.title
                }
            })
    };
});

vi.mock("../../../../src/shadcn/assistant-ui/thread-list", () => ({
    ThreadListSkeleton: () => null
}));

const mountedRoots: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
}> = [];

beforeEach(() => {
    fixture.threadId = "thread-1";
    fixture.title = "Saved title";
    fixture.isRunning = false;
    fixture.runtimeAvailable = true;
    fixture.getById.mockClear();
    fixture.runtimeUnsubscribe.mockClear();
    fixture.threadListUnsubscribe.mockClear();
    fixture.runtimeSubscribers.clear();
    fixture.threadListSubscribers.clear();
});

afterEach(async () => {
    for (const {container, root} of mountedRoots.splice(0)) {
        await act(async () => root.unmount());
        container.remove();
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderThreadList() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push({container, root});

    await act(async () => root.render(createElement(ThreadList)));
    return container;
}

async function notify(subscribers: Set<() => void>) {
    await act(async () => {
        for (const subscriber of [...subscribers]) subscriber();
    });
}

describe("ThreadList title", () => {
    test("shimmers the scoped thread title while its stream is running", async () => {
        fixture.isRunning = true;
        const container = await renderThreadList();
        const title = container.querySelector('[data-slot="aui_thread-list-item-title-text"]');
        const shimmer = container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]');

        expect(fixture.getById).toHaveBeenCalledWith("thread-1");
        expect(title?.textContent).toBe("Saved title");
        expect(shimmer?.textContent).toBe("Saved title");
        expect(shimmer?.hasAttribute("aria-hidden")).toBe(true);
        expect(shimmer?.className).toContain("shimmer");
        expect(shimmer?.className).toContain("pointer-events-none");
        expect(shimmer?.className).toContain("absolute");
        expect(shimmer?.className).toContain("inset-0");
        expect(shimmer?.className).toContain("truncate");
        expect(shimmer?.className).toContain("motion-reduce:animate-none");
    });

    test("keeps idle titles visible without a shimmer overlay", async () => {
        const container = await renderThreadList();

        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-text"]')?.textContent
        ).toBe("Saved title");
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).toBeNull();
    });

    test("reacts when the thread stream starts and stops", async () => {
        const container = await renderThreadList();

        fixture.isRunning = true;
        await notify(fixture.runtimeSubscribers);
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).not.toBeNull();

        fixture.isRunning = false;
        await notify(fixture.runtimeSubscribers);
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).toBeNull();
    });

    test("rebinds as a thread runtime becomes available or unavailable", async () => {
        fixture.runtimeAvailable = false;
        const container = await renderThreadList();

        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).toBeNull();
        expect(fixture.threadListSubscribers.size).toBe(1);

        fixture.runtimeAvailable = true;
        fixture.isRunning = true;
        await notify(fixture.threadListSubscribers);

        expect(fixture.threadListSubscribers.size).toBe(1);
        expect(fixture.runtimeSubscribers.size).toBe(1);
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).not.toBeNull();

        fixture.runtimeAvailable = false;
        await notify(fixture.threadListSubscribers);
        expect(fixture.runtimeSubscribers.size).toBe(0);
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).toBeNull();

        fixture.runtimeAvailable = true;
        await notify(fixture.threadListSubscribers);
        expect(fixture.runtimeSubscribers.size).toBe(1);
        expect(
            container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]')
        ).not.toBeNull();
    });

    test("uses the same fallback in the accessible and shimmer titles", async () => {
        fixture.title = undefined;
        fixture.isRunning = true;
        const container = await renderThreadList();
        const wrapper = container.querySelector('[data-slot="aui_thread-list-item-title"]');
        const title = container.querySelector('[data-slot="aui_thread-list-item-title-text"]');
        const shimmer = container.querySelector('[data-slot="aui_thread-list-item-title-shimmer"]');

        expect(wrapper?.className).toContain("overflow-hidden");
        expect(title?.className).toContain("truncate");
        expect(title?.textContent).toBe("New Chat");
        expect(shimmer?.textContent).toBe("New Chat");
    });

    test("cleans up runtime and fallback subscriptions", async () => {
        await renderThreadList();
        const firstMount = mountedRoots.pop();
        expect(firstMount).toBeDefined();
        await act(async () => firstMount?.root.unmount());
        firstMount?.container.remove();
        expect(fixture.runtimeUnsubscribe).toHaveBeenCalledOnce();
        expect(fixture.threadListUnsubscribe).toHaveBeenCalledOnce();

        fixture.threadListUnsubscribe.mockClear();
        fixture.runtimeAvailable = false;
        await renderThreadList();
        const secondMount = mountedRoots.pop();
        expect(secondMount).toBeDefined();
        await act(async () => secondMount?.root.unmount());
        secondMount?.container.remove();
        expect(fixture.threadListUnsubscribe).toHaveBeenCalledOnce();
    });
});
