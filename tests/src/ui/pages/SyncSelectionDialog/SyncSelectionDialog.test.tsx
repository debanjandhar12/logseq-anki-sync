import {act, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {SyncSelectionDialogComponent} from "../../../../../src/ui/pages/SyncSelectionDialog";

const state = vi.hoisted(() => ({activeModal: "selection"}));
vi.mock("../../../../../src/ui/UI", () => ({
    UI: {getActiveModal: () => state.activeModal, hideModal: vi.fn()}
}));
vi.mock("../../../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {
        getElementById: (id: string) => document.getElementById(id),
        getBody: () => document.body,
        addDocumentEventListener: (...args: Parameters<Document["addEventListener"]>) =>
            document.addEventListener(...args),
        removeDocumentEventListener: (...args: Parameters<Document["removeEventListener"]>) =>
            document.removeEventListener(...args)
    }
}));
vi.mock("../../../../../src/ui/modals/core/Modal", () => ({
    Modal: ({children}: {children: ReactNode}) => <div>{children}</div>
}));
vi.mock("../../../../../src/ui/modals/core/ModalHeader", () => ({
    ModalHeader: ({children}: {children: ReactNode}) => <header>{children}</header>
}));
vi.mock("../../../../../src/ui/modals/core/ModalFooter", () => ({
    DialogModalFooter: ({onConfirm, onCancel, children}) => (
        <footer>
            <button type="button" onClick={onConfirm}>
                Confirm
            </button>
            <button type="button" onClick={onCancel}>
                Cancel
            </button>
            {children}
        </footer>
    )
}));
vi.mock("../../../../../src/ui/components/LogseqButton", () => ({
    LogseqButton: ({children}) => <span>{children}</span>
}));
vi.mock("../../../../../src/ui/components/LogseqCheckbox", () => ({
    LogseqCheckbox: ({checked, onChange, children, indeterminate}) => (
        <label>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                data-indeterminate={indeterminate}
            />
            {children}
        </label>
    )
}));
vi.mock("../../../../../src/ui/components/LogseqDropdownMenu", () => ({
    LogseqDropdownMenu: ({menuArr}) => (
        <nav>
            {menuArr.map((item) => (
                <button type="button" key={item.title} onClick={item.onClick}>
                    {item.title}
                </button>
            ))}
        </nav>
    )
}));
vi.mock("../../../../../src/ui/components/LogseqPopover", () => ({
    LogseqPopover: ({children, content}) => (
        <>
            {children}
            {content}
        </>
    )
}));
vi.mock("../../../../../src/ui/components/LogseqTooltip", () => ({
    LogseqTooltip: ({children}) => <>{children}</>
}));
vi.mock("../../../../../src/ui/pages/SyncSelectionDialog/NoteLineDisplays", () => ({
    CreateLineDisplay: ({note}) => <span>{note.uuid}</span>,
    UpdateLineDisplay: ({note}) => <span>{note.uuid}</span>,
    DeleteLineDisplay: ({ankiId}) => <span>{ankiId}</span>
}));
vi.mock("../../../../../src/logseq/LogseqProxy", () => ({
    LogseqProxy: {Editor: {getBlock: vi.fn()}}
}));
vi.mock("../../../../../src/logseq/LogseqContentPreprocessor", () => ({
    LogseqContentPreprocessor: {}
}));

let root: Root;
let container: HTMLDivElement;
const created = [
    {uuid: "a", type: "cloze", page: {uuid: "page"}},
    {uuid: "b", type: "cloze", page: {uuid: "other"}}
];
const updated = [{uuid: "c", type: "cloze", page: {uuid: "page"}}];
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("logseq", {
        Editor: {getCurrentPage: vi.fn().mockResolvedValue({uuid: "page"})},
        App: {getCurrentGraph: vi.fn().mockResolvedValue({name: "graph"})},
        updateSettings: vi.fn()
    });
    state.activeModal = "selection";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function mount(resolve = vi.fn()) {
    await act(async () =>
        root.render(
            <SyncSelectionDialogComponent
                toCreateNotes={created}
                toUpdateNotes={updated}
                toDeleteNotes={[10]}
                resolve={resolve}
                reject={vi.fn()}
                modalContext={{modalId: "selection"}}
            />
        )
    );
    return resolve;
}
async function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === text
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
}
async function enter() {
    await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", cancelable: true}))
    );
}

test("Enter confirms current selection after Select None, not initial all-selected closure", async () => {
    const resolve = await mount();
    await click("Select None");
    await enter();
    expect(resolve.mock.calls[0][0]).toEqual({
        toCreateNotes: [],
        toUpdateNotes: [],
        toDeleteNotes: []
    });
});
test("individual toggle keeps original order/references and keyboard matches button confirmation", async () => {
    const resolve = await mount();
    await act(async () =>
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click()
    );
    await enter();
    expect(resolve.mock.calls[0][0]).toEqual({
        toCreateNotes: [created[1]],
        toUpdateNotes: updated,
        toDeleteNotes: [10]
    });
    expect(resolve.mock.calls[0][0].toCreateNotes[0]).toBe(created[1]);
});
test("current-page preset excludes deletion and nonmatching notes", async () => {
    const resolve = await mount();
    await click("Select Current Page Notes");
    await click("Confirm");
    expect(resolve.mock.calls[0][0]).toEqual({
        toCreateNotes: [created[0]],
        toUpdateNotes: updated,
        toDeleteNotes: []
    });
});
test("group toggles and presets maintain tri-state semantics", async () => {
    await mount();
    const inputs = () => container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => inputs()[1].click());
    expect(inputs()[0].dataset.indeterminate).toBe("true");
    await act(async () => inputs()[0].click());
    expect(inputs()[1].checked).toBe(true);
    await click("Select New Notes Only");
    expect(
        Array.from(inputs())
            .slice(0, 7)
            .map((input) => input.checked)
    ).toEqual([true, true, true, false, false, false, false]);
    await click("Select All");
    expect(Array.from(inputs()).every((input) => input.checked)).toBe(true);
});
test("nested-modal Enter is ignored; cancellation returns null", async () => {
    const resolve = await mount();
    state.activeModal = "nested";
    await enter();
    expect(resolve).not.toHaveBeenCalled();
    await click("Cancel");
    expect(resolve.mock.calls[0][0]).toBeNull();
});
