import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, expect, test, vi} from "vitest";
import type {SyncResult} from "../../../../../src/sync/types";
import {SyncResultDialogComponent} from "../../../../../src/ui/pages/SyncResultDialog";
import {SyncedAssetsSection} from "../../../../../src/ui/pages/SyncResultDialog/SyncedAssetsSection";
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
    const assetFailure = new Error("Asset upload failed");
    const successfulAsset = "assets:///graph/assets/my%20photo.png?version=2#preview";
    const failedAsset = "file:///graph/assets/failed.png";
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
                            toCreateAssets: [successfulAsset, failedAsset],
                            failedCreated: {"uuid-with-hyphens-cloze": failure},
                            failedUpdated: {"updated-cloze": failure},
                            failedDeleted: {10: failure},
                            failedAssets: {[failedAsset]: assetFailure}
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
            "Updated",
            "Synced Assets"
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
        const assetLink = container.querySelector<HTMLAnchorElement>(
            `a[href="${successfulAsset}"]`
        )!;
        expect(assetLink.textContent).toBe("my photo.png");
        expect(assetLink.title).toBe(successfulAsset);
        expect(
            assetLink.parentElement!.querySelector('[title="Synced Successfully"]')
        ).not.toBeNull();
        const failedAssetLink = container.querySelector<HTMLAnchorElement>(
            `a[href="${failedAsset}"]`
        )!;
        expect(failedAssetLink.textContent).toBe("failed.png");
        expect(container.querySelectorAll(`a[href="${failedAsset}"]`)).toHaveLength(1);
        expect(
            failedAssetLink.parentElement!.querySelector('[title="Sync Failed"]')
        ).not.toBeNull();
        await act(async () => failedAssetLink.parentElement!.querySelectorAll("a")[1].click());
        expect(showMsg).toHaveBeenLastCalledWith(
            `Error: Asset upload failed\n\nStack trace:\n${assetFailure.stack}`,
            "warning",
            {timeout: 0}
        );
    } finally {
        await act(async () => root.unmount());
    }
});

test.each([
    {assets: undefined},
    {assets: []}
])("empty and older asset results render an empty section (%j)", async ({assets}) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(<SyncedAssetsSection assets={assets} />));
        expect(container.textContent).toContain("Synced Assets");
        expect(container.textContent).toContain("No assets were synced.");
        expect(container.querySelector("a")).toBeNull();
    } finally {
        await act(async () => root.unmount());
    }
});

test("asset labels support native paths, blob URLs, and malformed percent escapes", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const urls = [
        "/graph/assets/local image.png",
        "C:\\graph\\assets\\windows image.png",
        "blob:https://logseq.example/blob-id",
        "file:///graph/assets/bad%escape.png"
    ];
    try {
        await act(async () => root.render(<SyncedAssetsSection assets={urls} failures={{}} />));
        expect(Array.from(container.querySelectorAll("a")).map((link) => link.textContent)).toEqual(
            ["local image.png", "windows image.png", "blob-id", "bad%escape.png"]
        );
        expect(container.textContent).not.toContain("No assets were synced.");
    } finally {
        await act(async () => root.unmount());
    }
});
