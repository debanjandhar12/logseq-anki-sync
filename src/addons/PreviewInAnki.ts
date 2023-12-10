import * as AnkiConnect from "../anki-connect/AnkiConnect";
import {handleAnkiError} from "../utils/utils";
import {Addon} from "./Addon";
import _ from "lodash";
import {SelectionModal} from "../ui/general/SelectionModal";

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
            logseq.App.registerPageMenuItem("Preview in Anki", this.previewPageNotesInAnki);
        }
    }

    private async previewBlockNotesInAnki(...blocks) {
        try {
            await AnkiConnect.requestPermission();
            await AnkiConnect.guiBrowse("uuid:" + blocks[0].uuid);
        } catch (e) {
            handleAnkiError(e.toString());
        }
    }

    private async previewPageNotesInAnki({page}) {
        try {
            const namespacePages = await logseq.Editor.getPagesFromNamespace(page);
            let pagesToView = [page];
            await AnkiConnect.requestPermission();
            let graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            let modelName = `${graphName}Model`.replace(/\s/g, "_");
            if (namespacePages.length > 0) {
                let selection = await SelectionModal([
                    {name: "Preview cards from this namespace in anki"},
                    {name: "Preview cards from this page in anki"},
                ]);
                if (selection == null) return;
                if (selection == "0")
                    pagesToView = [pagesToView, ...namespacePages.map((page) => page.name)];
            }
            await AnkiConnect.guiBrowse(
                `"note:${modelName}" "Breadcrumb:re:^<a.*>(${pagesToView
                    .map((page) => _.escapeRegExp(page).replaceAll('"', '\\"'))
                    .join("|")})</a>.*$"`,
            );
        } catch (e) {
            handleAnkiError(e.toString());
        }
    }

    public static getInstance(): Addon {
        if (!PreviewInAnkiContextMenu._instance)
            PreviewInAnkiContextMenu._instance = new PreviewInAnkiContextMenu();
        return PreviewInAnkiContextMenu._instance;
    }
}
