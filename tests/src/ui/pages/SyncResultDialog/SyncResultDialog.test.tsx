import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach, expect, test, vi} from "vitest";
import {WindowParentBridge} from "../../../../../src/logseq/WindowParentBridge";
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
vi.mock("../../../../../src/ui/components/LogseqTooltip", () => ({
    LogseqTooltip: ({children, content}) => <span data-tooltip={content}>{children}</span>
}));

vi.mock("../../../../../src/ui/pages/SyncSelectionDialog/NoteLineDisplays", () => ({
    CreateLineDisplay: ({note}) => <span data-create={note.uuid}>{note.type}</span>,
    UpdateLineDisplay: ({note}) => <span data-update={note.uuid}>{note.type}</span>
}));
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function getAssetControl(container: HTMLElement, url: string) {
    const tooltip = Array.from(container.querySelectorAll<HTMLElement>("[data-tooltip]")).find(
        (element) => element.dataset.tooltip === url
    )!;
    return tooltip.querySelector<HTMLAnchorElement | HTMLButtonElement>("a, button")!;
}

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
        const assetSectionHeading = Array.from(container.querySelectorAll(".p-4")).find(
            (element) => element.textContent === "Synced Assets"
        )!;
        expect(assetSectionHeading.parentElement!.classList.contains("pb-4")).toBe(true);
        expect(container.querySelector('[data-update="ok"]')).not.toBeNull();
        expect(container.querySelector('[data-update="uuid-with-hyphens"]')).toBeNull();
        expect(container.querySelector('[data-create="uuid-with-hyphens"]')).not.toBeNull();
        expect(container.querySelector('[data-update="updated"]')).not.toBeNull();
        expect(container.textContent).toContain("The 2 notes were deleted successfully");
        const errorButtons = Array.from(container.querySelectorAll("button")).filter(
            (button) => button.textContent === "(show error details)"
        );
        expect(errorButtons).toHaveLength(4);
        for (const button of errorButtons) {
            expect(button.type).toBe("button");
            expect(button.classList.contains("cursor-pointer")).toBe(true);
            expect(button.classList.contains("text-danger")).toBe(true);
            expect(button.classList.contains("hover:underline")).toBe(true);
            expect(button.classList.contains("focus-visible:underline")).toBe(true);
            expect(button.classList.contains("button")).toBe(false);
            expect(button.classList.contains("hover:bg-secondary-border")).toBe(false);
            expect(button.classList.contains("focus-visible:bg-secondary-border")).toBe(false);
        }
        await act(async () => errorButtons[0].click());
        expect(showMsg).toHaveBeenCalledWith(
            `Error: failure\n\nStack trace:\n${failure.stack}`,
            "warning",
            {timeout: 0}
        );
        const assetLink = getAssetControl(container, successfulAsset);
        expect(assetLink.textContent).toBe("my photo.png");
        expect(assetLink.parentElement!.dataset.tooltip).toBe(successfulAsset);
        expect(assetLink.hasAttribute("title")).toBe(false);
        const assetRow = assetLink.closest("span.flex-wrap")!;
        expect(assetRow.querySelector('[title="Synced Successfully"]')).not.toBeNull();
        const failedAssetLink = getAssetControl(container, failedAsset);
        expect(failedAssetLink.textContent).toBe("failed.png");
        expect(failedAssetLink.parentElement!.dataset.tooltip).toBe(failedAsset);
        expect(container.querySelectorAll(`[data-tooltip="${failedAsset}"]`)).toHaveLength(1);
        const failedAssetRow = failedAssetLink.closest("span.flex-wrap")!;
        expect(failedAssetRow.querySelector('[title="Sync Failed"]')).not.toBeNull();
        for (const link of [assetLink, failedAssetLink]) {
            expect(link.classList.contains("hover:underline")).toBe(false);
            for (const className of [
                "button",
                "bg-inherit",
                "hover:bg-secondary-border",
                "focus-visible:bg-secondary-border",
                "rounded-[2px]",
                "cursor-pointer",
                "select-text"
            ]) {
                expect(link.classList.contains(className)).toBe(true);
            }
        }
        await act(async () => failedAssetRow.querySelectorAll("button")[1].click());
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
        expect(urls.map((url) => getAssetControl(container, url).textContent)).toEqual([
            "local image.png",
            "windows image.png",
            "blob-id",
            "bad%escape.png"
        ]);
        expect(container.textContent).not.toContain("No assets were synced.");
    } finally {
        await act(async () => root.unmount());
    }
});

test.each([
    ["file:///graph/assets/my%20photo.png?version=2#preview", "/graph/assets/my photo.png"],
    ["assets:///graph/assets/my%20photo.png?version=2#preview", "/graph/assets/my photo.png"],
    ["file:///C:/graph/assets/photo.png", "C:/graph/assets/photo.png"],
    ["assets://C/logseq__colon/graph/assets/photo.png", "C:/graph/assets/photo.png"],
    ["file://server/share/photo.png", "//server/share/photo.png"],
    ["assets://server/share/photo.png", "//server/share/photo.png"],
    [
        "file:///graph/assets/question%3Fhash%23percent%2520.png",
        "/graph/assets/question?hash#percent%20.png"
    ],
    ["/graph/assets/local image.png", "/graph/assets/local image.png"],
    ["C:\\graph\\assets\\photo.png", "C:\\graph\\assets\\photo.png"]
])("local asset %s opens its resolved native path through the host", async (url, nativePath) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const openPath = vi.spyOn(WindowParentBridge, "openPath").mockReturnValue(null);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(<SyncedAssetsSection assets={[url]} />));
        const control = getAssetControl(container, url);
        expect(control.tagName).toBe("BUTTON");
        expect(control.hasAttribute("href")).toBe(false);
        await act(async () => control.click());
        expect(openPath).toHaveBeenCalledExactlyOnceWith(nativePath);
    } finally {
        await act(async () => root.unmount());
    }
});

test.each([
    "https://example.com/photo.png",
    "http://example.com/photo.png",
    "blob:https://logseq.example/blob-id",
    "data:image/png;base64,aGVsbG8="
])("browser asset %s remains a normal link rather than using the local file opener", async (url) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const openPath = vi.spyOn(WindowParentBridge, "openPath").mockReturnValue(null);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(<SyncedAssetsSection assets={[url]} />));
        const control = getAssetControl(container, url);
        expect(control.tagName).toBe("A");
        expect(control.getAttribute("href")).toBe(url);
        expect(control.getAttribute("target")).toBe("_blank");
        expect(control.getAttribute("rel")).toBe("noreferrer");
        expect(openPath).not.toHaveBeenCalled();
    } finally {
        await act(async () => root.unmount());
    }
});

test.each([
    {
        url: "file:///assets/bad%escape.png",
        openError: undefined,
        message: "Unable to resolve local asset: file:///assets/bad%escape.png"
    },
    {
        url: "javascript:alert(1)",
        openError: undefined,
        message: "Unable to resolve local asset: javascript:alert(1)"
    },
    {
        url: "file:///assets/photo.png",
        openError: new Error("File opener unavailable"),
        message: "File opener unavailable"
    }
])("asset-opening failures are reported without browser navigation ($url)", async ({
    url,
    openError,
    message
}) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const showMsg = vi.fn();
    vi.stubGlobal("logseq", {UI: {showMsg}});
    const openPath = vi.spyOn(WindowParentBridge, "openPath").mockImplementation(() => {
        if (openError) throw openError;
        return null;
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(<SyncedAssetsSection assets={[url]} />));
        const control = getAssetControl(container, url);
        expect(control.hasAttribute("href")).toBe(false);
        await act(async () => control.click());
        expect(showMsg).toHaveBeenCalledWith(`Unable to open asset: ${message}`, "warning");
        expect(openPath).toHaveBeenCalledTimes(openError ? 1 : 0);
    } finally {
        await act(async () => root.unmount());
    }
});
