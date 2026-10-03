import type React from "react";
import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {SkillStore} from "../../../../../src/core/stores/skill-store/SkillStore";
import {MustacheView} from "../../../../../src/core/template-engine";
import {SkillEditorModalComponent} from "../../../../../src/ui/pages/SkillEditorModal/SkillEditorModal";

vi.mock("../../../../../src/ui/pages/SkillEditorModal/createSkillEditorExtensions", () => ({
    createSkillEditorExtensions: () => []
}));
vi.mock("../../../../../src/ui/components/LogseqCodeEditor", () => ({
    LogseqCodeEditor: ({
        value,
        onChange,
        editable
    }: {
        value: string;
        onChange: (value: string) => void;
        editable: boolean;
    }) => (
        <textarea
            aria-label="SKILL.md"
            value={value}
            disabled={!editable}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));
vi.mock("../../../../../src/ui/components/LogseqButton", () => ({
    LogseqButton: ({
        children,
        onClick,
        disabled,
        title
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button type="button" onClick={onClick} disabled={disabled} title={title}>
            {children}
        </button>
    )
}));
vi.mock("../../../../../src/ui/components/LogseqCheckbox", () => ({LogseqCheckbox: () => null}));
vi.mock("../../../../../src/ui/modals/core/Modal", () => ({
    Modal: ({children}: React.PropsWithChildren) => <div>{children}</div>
}));
vi.mock("../../../../../src/ui/modals/core/ModalHeader", () => ({ModalHeader: () => null}));
vi.mock("../../../../../src/ui/modals/hooks/useModal", () => ({
    useModal: (resolve: (value: boolean | null) => void) => ({
        open: true,
        setOpen: vi.fn(),
        returnResult: resolve
    })
}));
vi.mock("../../../../../src/ui/UI", () => ({UI: {hideModal: vi.fn()}}));
vi.mock("../../../../../src/ui/launchers/showConfirmModal", () => ({showConfirmModal: vi.fn()}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue([]);
    vi.spyOn(logseq.UI, "showMsg").mockResolvedValue(undefined as never);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test("failed persistence keeps the modal draft and original folder identity for retry", async () => {
    const source = "---\nname: alpha\ndescription: Original\n---\nInstructions";
    vi.spyOn(SkillStore, "getAllSkills").mockResolvedValue([
        {name: "alpha", folderName: "alpha", description: "Original", content: source}
    ]);
    const save = vi
        .spyOn(SkillStore, "saveEditedSkills")
        .mockRejectedValueOnce(new Error("storage failed"))
        .mockResolvedValue(undefined);
    const resolve = vi.fn();
    await act(async () =>
        root.render(<SkillEditorModalComponent resolve={resolve} reject={vi.fn()} />)
    );
    const editor = container.querySelector("textarea")!;
    const draft = source.replace("name: alpha", "name: beta");
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
            editor,
            draft
        );
        editor.dispatchEvent(new Event("input", {bubbles: true}));
    });
    const saveButton = () =>
        [...container.querySelectorAll("button")].find((button) => button.textContent === "Save")!;
    await act(async () => saveButton().click());
    expect(resolve).not.toHaveBeenCalled();
    expect(editor.value).toBe(draft);
    expect(logseq.UI.showMsg).toHaveBeenCalledWith(
        "Failed to save skill files: storage failed",
        "error"
    );
    expect(save).toHaveBeenCalledWith(
        [
            expect.objectContaining({
                content: draft,
                originalSkillName: "alpha",
                originalContent: source
            })
        ],
        ["alpha"]
    );
    await act(async () => saveButton().click());
    expect(save).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith(true);
});
