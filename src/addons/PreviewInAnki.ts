import * as AnkiConnect from "../anki-connect/AnkiConnect";
import { get_better_error_msg } from "../utils/utils";
import { Addon } from "./Addon";

export class PreviewInAnkiContextMenu extends Addon {
    static _instance: PreviewInAnkiContextMenu;

    public getName(): string {
        return "Preview Cards in Anki";
    }

    public init(): void {
        if (this.isEnabled()) {
            logseq.Editor.registerBlockContextMenuItem(
                "Preview in Anki",
                this.previewBlockNotesInAnki,
            );
        }
    }
    private async previewBlockNotesInAnki(...blocks) {
        try {
            await AnkiConnect.requestPermission();
            await AnkiConnect.guiBrowse("uuid:" + blocks[0].uuid);
        } catch (e) {
            logseq.UI.showMsg(get_better_error_msg(e.toString()), "error", {
                timeout: 4000,
            });
        }
    }

    public static getInstance(): Addon {
        if (!PreviewInAnkiContextMenu._instance)
            PreviewInAnkiContextMenu._instance = new PreviewInAnkiContextMenu();
        return PreviewInAnkiContextMenu._instance;
    }
}
