import * as AnkiConnect from "../anki-connect/AnkiConnect";
import { get_better_error_msg } from "../utils/utils";
import { Addon } from "./Addon";
import _ from "lodash";

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
            logseq.App.registerPageMenuItem(
                "Preview in Anki",
                this.previewPageNotesInAnki,
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

    private async previewPageNotesInAnki({ page }) {
        try {
            await AnkiConnect.requestPermission();
            let graphName =
                _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            let modelName = `${graphName}Model`.replace(/\s/g, "_");
            await AnkiConnect.guiBrowse(
                `note:${modelName} "Breadcrumb:re:^<a.*>${_.escapeRegExp(
                    page,
                ).replaceAll('"', '\\"')}</a>.*$"`,
            );
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
