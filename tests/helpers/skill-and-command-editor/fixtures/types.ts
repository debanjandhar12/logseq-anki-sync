import type {Locator} from "vitest/browser";

export type EditorKind = "skill" | "command";

export interface EditorControls {
    root: Locator;
    dialog: Locator;
    content: Locator;
    enabled: Locator;
    newButton: Locator;
    deleteButton: Locator;
    saveButton: Locator;
    cancelButton: Locator;
    file(displayName: string): Locator;
}

export interface EditorFixture {
    mount(kind: EditorKind): Promise<EditorControls>;
    unmount(): Promise<void>;
    result(): Promise<boolean | null>;
}
