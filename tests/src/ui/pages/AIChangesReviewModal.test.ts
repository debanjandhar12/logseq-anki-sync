import {FileIcon, HashIcon} from "lucide-react";
import type {ReactElement, ReactNode} from "react";
import {describe, expect, test, vi} from "vitest";
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
    test("renders the ghost Continue action separately from Commit and Discard", () => {
        const footer = AIChangesReviewModalFooter({
            onContinue: vi.fn(),
            onDiscard: vi.fn(),
            onCommit: vi.fn()
        });

        expect(footer).not.toBeNull();
        if (!footer) return;
        const footerElement = footer as ReactElement<{children: ReactElement[]}>;
        const [continueContainer, actionContainer] = footerElement.props.children;
        const continueButton = continueContainer as ReactElement<{children: ReactElement}>;
        const actions = actionContainer as ReactElement<{children: ReactElement[]}>;
        const [commitButton, discardButton] = actions.props.children;
        const continueAction = continueButton.props.children as ReactElement<{
            color: string;
            children: ReactNode;
        }>;

        expect(continueAction.props).toMatchObject({
            color: "ghost",
            children: "Continue (Commit Later)"
        });
        expect(commitButton.props).toMatchObject({
            color: "primary",
            children: "Commit changes"
        });
        expect(discardButton.props).toMatchObject({
            color: "failed",
            children: "Discard uncommitted changes"
        });
    });
});
