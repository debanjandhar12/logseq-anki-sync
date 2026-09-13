import {act, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {ButtonModalComponent} from "../../../../src/ui/modals/ButtonModal";
import {ConfirmModalComponent} from "../../../../src/ui/modals/ConfirmModal";
import {Modal} from "../../../../src/ui/modals/core/Modal";
import {ModalHeader, SimpleModalHeader} from "../../../../src/ui/modals/core/ModalHeader";
import {InputModalComponent} from "../../../../src/ui/modals/InputModal";
import {SelectionModalComponent} from "../../../../src/ui/modals/SelectionModal";
import {AICommandPaletteModalComponent} from "../../../../src/ui/pages/AICommandPaletteModal/AICommandPaletteModal";

vi.mock("../../../../src/ui/UI", () => ({
    UI: {getModalCount: () => 1, getActiveModal: () => null, hideModal: vi.fn()}
}));
vi.mock("../../../../src/ui/modals/hooks/useModal", () => ({
    useModal: () => ({
        open: true,
        setOpen: vi.fn(),
        handleConfirm: vi.fn(),
        handleCancel: vi.fn(),
        returnResult: vi.fn()
    })
}));
vi.mock("../../../../src/logseq/WindowBridge", () => ({
    WindowBridge: {addDocumentEventListener: vi.fn(), removeDocumentEventListener: vi.fn()}
}));

let container: HTMLDivElement;
let root: Root;
const setOpen = vi.fn();
const consumerProps = {resolve: vi.fn(), reject: vi.fn()};

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render(children: ReactNode) {
    await act(async () => root.render(children));
}

function dialog() {
    const panel = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-modal")).toBe("true");
    return panel;
}

function linkedTitle(panel: HTMLElement) {
    const id = panel.getAttribute("aria-labelledby");
    expect(id).toBeTruthy();
    const title = document.getElementById(id);
    expect(title).not.toBeNull();
    expect(panel.contains(title)).toBe(true);
    return title;
}

test("the dialog panel is named by its heading, excluding decorative icon and close controls", async () => {
    await render(
        <Modal open setOpen={setOpen}>
            <ModalHeader title="Provider Configurations" icon="Decorative icon" />
        </Modal>
    );

    const title = linkedTitle(dialog());
    expect(title.tagName).toBe("H3");
    expect(title.querySelector("strong").textContent).toBe("Provider Configurations");
    expect(title.querySelector("i").getAttribute("aria-hidden")).toBe("true");
    expect(title.contains(container.querySelector('[aria-label="Close"]'))).toBe(false);
});

test("confirmation is named by the rendered HTML guard text without flattening its semantics", async () => {
    await render(
        <ConfirmModalComponent
            {...consumerProps}
            message="Discard <strong>uncommitted changes</strong>?"
        />
    );

    const title = linkedTitle(dialog());
    expect(title.textContent).toBe("Discard uncommitted changes?");
    expect(title.querySelector("strong").textContent).toBe("uncommitted changes");
    expect(dialog().hasAttribute("aria-label")).toBe(false);
});

test("an explicit label overrides the automatic heading reference", async () => {
    await render(
        <Modal open setOpen={setOpen} aria-label="Explicit dialog name">
            <SimpleModalHeader title="Visible title" />
        </Modal>
    );

    expect(dialog().getAttribute("aria-label")).toBe("Explicit dialog name");
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
    expect(container.querySelector(".headline").textContent).toBe("Visible title");
});

test("an explicit labelledby reference takes precedence over automatic naming", async () => {
    await render(
        <Modal open setOpen={setOpen} aria-label="Fallback" aria-labelledby="custom-title">
            <h2 id="custom-title">Custom title</h2>
            <ModalHeader title="Shared header" />
        </Modal>
    );

    expect(linkedTitle(dialog()).textContent).toBe("Custom title");
});

test("stacked dialogs have distinct heading references", async () => {
    await render(
        <>
            <Modal open setOpen={setOpen}>
                <ModalHeader title="First dialog" />
            </Modal>
            <Modal open setOpen={setOpen}>
                <SimpleModalHeader title="Second dialog" />
            </Modal>
        </>
    );

    const panels = [...container.querySelectorAll<HTMLElement>('[role="dialog"]')];
    expect(panels).toHaveLength(2);
    expect(panels[0].getAttribute("aria-labelledby")).not.toBe(
        panels[1].getAttribute("aria-labelledby")
    );
    expect(panels.map((panel) => linkedTitle(panel).textContent)).toEqual([
        "First dialog",
        "Second dialog"
    ]);
});

test("closed dialogs are absent and retain their heading identity when reopened", async () => {
    const modal = (open: boolean) => (
        <Modal open={open} setOpen={setOpen}>
            <ModalHeader title="Stable title" />
        </Modal>
    );
    await render(modal(true));
    const id = linkedTitle(dialog()).id;
    await render(modal(false));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await render(modal(true));
    expect(linkedTitle(dialog()).id).toBe(id);
});

test("the command palette has an explicit accessible name without a shared header", async () => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        }
    );
    await render(<AICommandPaletteModalComponent {...consumerProps} commands={[]} />);
    expect(dialog().getAttribute("aria-label")).toBe("AI commands");
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
});

test("button dialogs are named by the rendered message", async () => {
    await render(
        <ButtonModalComponent
            {...consumerProps}
            message="Choose <strong>an action</strong>"
            buttons={[]}
        />
    );
    expect(linkedTitle(dialog()).textContent).toBe("Choose an action");
});

test.each([
    {title: "Rename conversation", message: "Enter a name", expected: "Rename conversation"},
    {title: undefined, message: "Enter a name", expected: "Enter a name"},
    {title: undefined, message: undefined, expected: "Input"}
])("input dialog is named $expected", async ({title, message, expected}) => {
    await render(<InputModalComponent {...consumerProps} title={title} message={message} />);
    expect(dialog().getAttribute("aria-label")).toBe(expected);
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
});

test.each([
    {message: "Choose a model", expected: "Choose a model"},
    {message: undefined, expected: "Select an option"}
])("selection dialog is named $expected", async ({message, expected}) => {
    await render(<SelectionModalComponent {...consumerProps} items={[]} message={message} />);
    expect(dialog().getAttribute("aria-label")).toBe(expected);
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
});
