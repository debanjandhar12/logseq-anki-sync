import {expect, test, vi} from "vitest";
import * as ui from "../../../../src/ui";
import {HighlightMaskEditorComponent} from "../../../../src/ui/pages/HighlightMaskEditor";
import {OcclusionEditorComponent} from "../../../../src/ui/pages/OcclusionEditor";
import {SyncResultDialogComponent} from "../../../../src/ui/pages/SyncResultDialog";
import * as selection from "../../../../src/ui/pages/SyncSelectionDialog";

vi.mock("fabric", () => ({fabric: {}}));
vi.mock("tesseract.js", () => ({createWorker: vi.fn(), PSM: {SPARSE_TEXT: 11}}));

test("directory entry points preserve the root UI barrel's public component identities", () => {
    expect(ui.HighlightMaskEditorComponent).toBe(HighlightMaskEditorComponent);
    expect(ui.OcclusionEditorComponent).toBe(OcclusionEditorComponent);
    expect(ui.SyncResultDialogComponent).toBe(SyncResultDialogComponent);
    for (const [publicExport, moduleExport] of [
        [ui.SyncSelectionDialogComponent, selection.SyncSelectionDialogComponent],
        [ui.AnkiLink, selection.AnkiLink],
        [ui.LogseqLink, selection.LogseqLink],
        [ui.CreateLineDisplay, selection.CreateLineDisplay],
        [ui.UpdateLineDisplay, selection.UpdateLineDisplay],
        [ui.DeleteLineDisplay, selection.DeleteLineDisplay]
    ]) {
        expect(typeof moduleExport).toBe("function");
        expect(publicExport).toBe(moduleExport);
    }
});
