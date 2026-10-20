import {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {showToolbarMenu} from "../../../src/ui/pages/LogseqAnkiSyncToolbarMenu";

const mocks = vi.hoisted(() => ({
    showModal: vi.fn(),
    hideModal: vi.fn(),
    sync: vi.fn(),
    result: vi.fn(),
    lastSync: undefined as unknown
}));
vi.mock("../../../src/ui/UI", () => ({
    UI: {showModal: mocks.showModal, hideModal: mocks.hideModal}
}));
vi.mock("../../../src/sync/syncLogseqToAnki", () => ({
    LogseqToAnkiSync: class {
        sync = mocks.sync;
    }
}));
vi.mock("../../../src/ui/launchers/showSyncResultDialog", () => ({
    showSyncResultDialog: mocks.result
}));
vi.mock("../../../src/logseq/WindowParentBridge", () => ({
    WindowParentBridge: {
        getDocument: () => parentDocument,
        getGlobalObject: () => mocks.lastSync
    }
}));

let container: HTMLDivElement;
let root: Root;
let parentDocument: Document;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("logseq", {showSettingsUI: vi.fn()});
    mocks.lastSync = undefined;
    parentDocument = document.implementation.createHTMLDocument("Host Logseq document");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

async function mount() {
    showToolbarMenu(null);
    await act(async () => root.render(mocks.showModal.mock.calls[0][0]));
}

function items() {
    return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
}

async function key(key: string) {
    await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", {key, cancelable: true}));
    });
}

test("preserves Anki actions, native disabled state, and enabled documentation", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await mount();
    expect(items().map((item) => item.textContent.trim())).toEqual([
        "Start Sync",
        "Last Sync Details",
        "Documentation",
        "Settings",
        "Donate"
    ]);
    expect(items()[1].disabled).toBe(true);
    expect(items()[2].disabled).toBe(false);
    await act(async () => items()[2].click());
    expect(open).toHaveBeenCalledWith(
        "https://debanjandhar12.github.io/logseq-anki-sync/docs/intro"
    );
    expect(mocks.hideModal).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(150));
    expect(mocks.hideModal).toHaveBeenCalledTimes(1);
});

test("arrow selection skips disabled actions and Enter invokes once", async () => {
    await mount();
    await key("ArrowDown");
    await key("Enter");
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(mocks.result).not.toHaveBeenCalled();
});

test("Last Sync Details reads the fresh result when activated", async () => {
    mocks.lastSync = {old: true};
    await mount();
    const fresh = {new: true};
    mocks.lastSync = fresh;
    await act(async () => items()[1].click());
    expect(mocks.result).toHaveBeenCalledWith(fresh);
});

test("Enter on a focused menu button is handled once", async () => {
    await mount();
    await key("ArrowDown");
    items()[0].focus();
    const event = new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true});
    await act(async () => items()[0].dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
});

test("selection wraps and skips disabled Last Sync Details", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await mount();
    await key("ArrowDown");
    await key("ArrowDown");
    await key("Enter");
    expect(open).toHaveBeenCalledWith(
        "https://debanjandhar12.github.io/logseq-anki-sync/docs/intro"
    );
    expect(mocks.result).not.toHaveBeenCalled();
    await key("ArrowUp");
    await key("ArrowUp");
    await key("Enter");
    expect(open).toHaveBeenCalledWith("https://github.com/sponsors/debanjandhar12");
});

test("backdrop and Escape close the menu, and unmount removes keyboard handlers", async () => {
    await mount();
    await key("Escape");
    await act(async () =>
        container.querySelector<HTMLButtonElement>('[aria-label="Close toolbar menu"]').click()
    );
    await act(async () => vi.advanceTimersByTime(150));
    expect(mocks.hideModal).toHaveBeenCalledTimes(2);
    await act(async () => root.render(null));
    await key("ArrowDown");
    await key("Enter");
    expect(mocks.sync).not.toHaveBeenCalled();
});
