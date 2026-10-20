import {act, createRef, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {LogseqButton} from "../../../src/ui/components/LogseqButton";
import {LogseqCheckbox} from "../../../src/ui/components/LogseqCheckbox";
import {LogseqInput} from "../../../src/ui/components/LogseqInput";
import {LogseqSelect} from "../../../src/ui/components/LogseqSelect";
import {ModalFooter} from "../../../src/ui/modals/core/ModalFooter";

let container: HTMLDivElement;
let root: Root;

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

test("checkboxes omit empty label content and preserve indeterminate state", async () => {
    await render(<LogseqCheckbox indeterminate onChange={vi.fn()} />);
    expect(container.querySelector(".html-content")).toBeNull();
    expect(container.querySelector("input").indeterminate).toBe(true);
    await render(
        <LogseqCheckbox checked={false} onChange={vi.fn()}>
            Label
        </LogseqCheckbox>
    );
    expect(container.querySelector(".html-content").textContent).toBe("Label");
});

test("input forwards its ref, invalid/disabled attributes, and style overrides", async () => {
    const ref = createRef<HTMLInputElement>();
    await render(<LogseqInput ref={ref} invalid disabled style={{borderColor: "red"}} />);
    expect(ref.current).toBe(container.querySelector("input"));
    expect(ref.current.disabled).toBe(true);
    expect(ref.current.getAttribute("aria-invalid")).toBe("true");
    expect(ref.current.style.borderColor).toBe("red");
});

test("select forwards new field metadata, state, ref, and source default height", async () => {
    const ref = createRef<HTMLSelectElement>();
    await render(
        <LogseqSelect
            ref={ref}
            id="deck"
            errorField="deck"
            disabled
            invalid
            value="a"
            onChange={vi.fn()}
            options={[{value: "a", label: "A"}]}
        />
    );
    expect(ref.current).toBe(container.querySelector("select"));
    expect(ref.current.id).toBe("deck");
    expect(ref.current.dataset.errorField).toBe("deck");
    expect(ref.current.disabled).toBe(true);
    expect(ref.current.getAttribute("aria-invalid")).toBe("true");
    expect(ref.current.parentElement.style.height).toBe("2.25rem");
});

test.each([
    "primary",
    "secondary"
] as const)("%s buttons use the matching foreground", async (color) => {
    await render(<LogseqButton color={color}>Action</LogseqButton>);
    expect(container.querySelector("button").classList.contains(`text-${color}-foreground`)).toBe(
        true
    );
});

test("footer disables native buttons and supports cancel color", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    await render(
        <ModalFooter
            onConfirm={onConfirm}
            onCancel={onCancel}
            confirmDisabled
            cancelDisabled
            cancelColor="secondary"
        />
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons[1].classList.contains("bg-secondary")).toBe(true);
    buttons.forEach((button) => button.click());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
});
