import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, expect, test, vi} from "vitest";
import type {SyncResult} from "../../../../../src/sync/types";
import {SyncResultDialogComponent} from "../../../../../src/ui/pages/SyncResultDialog";
import {parseFailedNoteKey} from "../../../../../src/ui/pages/SyncResultDialog/utils/parseFailedNoteKey";

vi.mock("../../../../../src/ui/UI", () => ({UI: {hideModal: vi.fn()}}));
vi.mock("../../../../../src/ui/modals/hooks/useModal", () => ({
    useModal: () => ({open: true, setOpen: vi.fn()})
}));
vi.mock("../../../../../src/ui/modals/core/Modal", () => ({
    Modal: ({children}) => <div>{children}</div>
}));
vi.mock("../../../../../src/ui/modals/core/ModalHeader", () => ({ModalHeader: () => null}));

vi.mock("../../../../../src/ui/pages/SyncSelectionDialog/NoteLineDisplays", () => ({
    CreateLineDisplay: ({note}) => <span data-create={note.uuid}>{note.type}</span>,
    UpdateLineDisplay: ({note}) => <span data-update={note.uuid}>{note.type}</span>
}));
afterEach(() => vi.unstubAllGlobals());

test("failure keys split at the last hyphen", () => {
    expect(parseFailedNoteKey("uuid-with-hyphens-cloze")).toEqual({
        uuid: "uuid-with-hyphens",
        type: "cloze"
    });
});

test("results filter failed successes, preserve partial failure rows and show persistent error details", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const showMsg = vi.fn();
    vi.stubGlobal("logseq", {
        UI: {showMsg},
        App: {getCurrentGraph: vi.fn().mockResolvedValue({name: "graph"})}
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    const failure = new Error("failure");
    try {
        await act(async () =>
            root.render(
                <SyncResultDialogComponent
                    syncResult={
                        {
                            toCreateNotes: [
                                {uuid: "ok", type: "cloze"},
                                {uuid: "uuid-with-hyphens", type: "cloze"}
                            ],
                            toUpdateNotes: [],
                            toDeleteNotes: [10, 20],
                            failedCreated: {"uuid-with-hyphens-cloze": failure},
                            failedUpdated: {"updated-cloze": failure},
                            failedDeleted: {10: failure}
                        } as unknown as SyncResult
                    }
                    resolve={vi.fn()}
                    reject={vi.fn()}
                />
            )
        );
        expect(Array.from(container.querySelectorAll(".p-4")).map((el) => el.textContent)).toEqual([
            "Created",
            "Deleted",
            "Updated"
        ]);
        expect(container.querySelector('[data-update="ok"]')).not.toBeNull();
        expect(container.querySelector('[data-update="uuid-with-hyphens"]')).toBeNull();
        expect(container.querySelector('[data-create="uuid-with-hyphens"]')).not.toBeNull();
        expect(container.querySelector('[data-update="updated"]')).not.toBeNull();
        expect(container.textContent).toContain("The 2 notes were deleted successfully");
        await act(async () => container.querySelector("a")!.click());
        expect(showMsg).toHaveBeenCalledWith(
            `Error: failure\n\nStack trace:\n${failure.stack}`,
            "warning",
            {timeout: 0}
        );
    } finally {
        await act(async () => root.unmount());
    }
});
