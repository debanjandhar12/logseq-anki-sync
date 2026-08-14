import {FileIcon, HashIcon} from "lucide-react";
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {DiffViewer} from "../../../../src/chat-app/components/DiffViewer";
import type {LogseqPrintedPageChange} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {
    AIChangesReviewModalFooter,
    createAIChangesReviewDiffViewers
} from "../../../../src/ui/pages/AIChangesReviewModal";

function change(overrides: Partial<LogseqPrintedPageChange> = {}): LogseqPrintedPageChange {
    return {
        key: "change-1",
        before: {pageName: "Page", content: "Before", pageType: "logseq-page"},
        after: {pageName: "Page", content: "After", pageType: "logseq-page"},
        ...overrides
    };
}

describe("createAIChangesReviewDiffViewers", () => {
    test("uses the before page type for existing and deleted pages", () => {
        const [viewer] = createAIChangesReviewDiffViewers([
            change({
                before: {pageName: "#tag", content: "Before", pageType: "logseq-tag-page"},
                after: {pageName: "[DOES NOT EXIST]", content: "", pageType: null}
            })
        ]);

        const props = viewer.props as {showIcon: boolean; fileIcon: unknown};
        expect(viewer.type).toBe(DiffViewer);
        expect(props.showIcon).toBe(true);
        expect(props.fileIcon).toBe(HashIcon);
    });

    test("falls back to the after page type for created pages", () => {
        const [viewer] = createAIChangesReviewDiffViewers([
            change({
                before: {pageName: "[DOES NOT EXIST]", content: "", pageType: null},
                after: {pageName: "Created", content: "After", pageType: "logseq-page"}
            })
        ]);

        expect((viewer.props as {fileIcon: unknown}).fileIcon).toBe(FileIcon);
    });
});

describe("AIChangesReviewModalFooter", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    });

    const renderFooter = async (onConfirm = vi.fn()) => {
        await act(async () => {
            root.render(createElement(AIChangesReviewModalFooter, {onConfirm}));
        });
        return onConfirm;
    };

    const getButton = (name: string) => {
        const button = Array.from(container.querySelectorAll("button")).find(
            (candidate) => candidate.textContent?.trim() === name
        );
        expect(button).toBeDefined();
        return button as HTMLButtonElement;
    };

    const click = async (element: HTMLElement) => {
        await act(async () => element.click());
    };

    test("defaults to approving and committing", async () => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector('[aria-label="Review action"]');

        expect(trigger?.textContent).toContain("Approve and Commit");
        await click(getButton("Confirm"));

        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onConfirm).toHaveBeenCalledWith("commit");
    });

    test("shows the review actions in the requested order", async () => {
        await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );
        expect(trigger).not.toBeNull();

        await click(trigger!);

        expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
        expect(trigger?.getAttribute("aria-expanded")).toBe("true");
        const listbox = container.querySelector('[role="listbox"]');
        const options = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []);
        expect(options.map((option) => option.textContent?.trim())).toEqual([
            "Approve and Commit",
            "Reject and Revert Changes",
            "Defer Commit"
        ]);
        expect(options[0]?.className).toContain("text-green-600");
        expect(options[1]?.className).toContain("text-red-600");
        expect(options[2]?.className).toContain("text-amber-600");
        expect(options[0]?.getAttribute("aria-selected")).toBe("true");
        expect(container.textContent).not.toContain("Continue (Commit Later)");
        expect(container.textContent).not.toContain("Discard uncommitted changes");
    });

    test.each([
        ["Reject and Revert Changes", "discard"],
        ["Defer Commit", "defer-commit"]
    ])("confirms %s only after selection", async (label, expectedResult) => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );

        await click(trigger!);
        await click(getButton(label));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(trigger?.textContent).toContain(label);
        expect(trigger?.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(trigger);

        await click(getButton("Confirm"));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onConfirm).toHaveBeenCalledWith(expectedResult);
    });

    test("closes the selector on Escape without confirming", async () => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );

        await click(trigger!);
        const listbox = container.querySelector<HTMLElement>('[role="listbox"]');
        expect(listbox).not.toBeNull();

        await act(async () => {
            listbox?.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
        });

        expect(container.querySelector('[role="listbox"]')).toBeNull();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(trigger);
    });

    test("selects an action with arrow keys without confirming", async () => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );
        trigger?.focus();

        await act(async () => {
            trigger?.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true}));
        });
        const selectedOption = container.querySelector<HTMLElement>(
            '[role="option"][aria-selected="true"]'
        );
        await act(async () => {
            selectedOption?.dispatchEvent(
                new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true})
            );
        });
        const activeOption = document.activeElement as HTMLElement;
        expect(activeOption.textContent).toContain("Reject and Revert Changes");

        await act(async () => {
            activeOption.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true}));
        });

        expect(trigger?.textContent).toContain("Reject and Revert Changes");
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test("closes the selector after an outside pointer interaction", async () => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );
        const outside = document.createElement("button");
        document.body.append(outside);

        await click(trigger!);
        expect(container.querySelector('[role="listbox"]')).not.toBeNull();
        await act(async () => {
            outside.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true}));
        });

        expect(container.querySelector('[role="listbox"]')).toBeNull();
        expect(onConfirm).not.toHaveBeenCalled();
        outside.remove();
    });

    test.each([
        ["forward", "Confirm"],
        ["backward", "Review action"]
    ])("closes the selector when focus moves %s out of it", async (_direction, targetName) => {
        const onConfirm = await renderFooter();
        const trigger = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Review action"]'
        );

        await click(trigger!);
        const selectedOption = container.querySelector<HTMLButtonElement>(
            '[role="option"][aria-selected="true"]'
        );
        selectedOption?.focus();
        const focusTarget =
            targetName === "Confirm" ? getButton("Confirm") : (trigger as HTMLButtonElement);

        await act(async () => focusTarget.focus());

        expect(container.querySelector('[role="listbox"]')).toBeNull();
        expect(document.activeElement).toBe(focusTarget);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
