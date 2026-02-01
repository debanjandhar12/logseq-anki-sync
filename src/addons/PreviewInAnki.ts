import * as AnkiConnect from "../anki-connect/AnkiConnect";
import { handleAnkiError } from "../utils/utils";
import { Addon } from "./Addon";
import _ from "lodash";
import { showSelectionModal } from "../ui";
import getNameFromPage from "../logseq/getNameFromPage";
import getIDFromPage from "../logseq/getIDFromPage";
import { LogseqProxy } from "../logseq/LogseqProxy";
import { LogseqNamespaceHelper } from "../logseq/LogseqNamespaceHelper";

export class PreviewInAnkiContextMenu extends Addon {
    static _instance: PreviewInAnkiContextMenu;

    public getName(): string {
        return "Preview Cards in Anki Context Menu";
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
            await AnkiConnect.guiBrowse(`"Logseq Block UUID:${blocks[0].uuid}"`);
        } catch (e) {
            handleAnkiError(e.toString());
        }
    }

    private async previewPageNotesInAnki(arg : { page: string}) {
        try {
            const pageObj = await LogseqProxy.Editor.getPage(arg.page); // Ideally, we should pass page.id but it is not passed
            if (pageObj) {
                const namespacePages = await LogseqNamespaceHelper.getNamespaceDescendants(pageObj);
                let pagesToView = [pageObj];
                await AnkiConnect.requestPermission();
                let graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
                let modelName = `${graphName}Model`.replace(/\s/g, "_");
                if (namespacePages.length > 0) {
                    let selection = await showSelectionModal([
                        { name: "Preview cards from this namespace in anki" },
                        { name: "Preview cards from this page in anki" },
                    ]);
                    if (selection == null) return;
                    if (selection === 0) {
                        pagesToView = [...pagesToView, ...namespacePages];
                    }
                }
                const pageIds = pagesToView.map(page => getIDFromPage(page)).filter(id => id != null);
                await AnkiConnect.guiBrowse(
                    `"note:${modelName}" "Logseq Page Id:${pageIds.join(" OR ")}"`,
                );
            }
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