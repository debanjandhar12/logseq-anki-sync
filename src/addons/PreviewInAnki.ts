import _ from "lodash";
import * as AnkiConnect from "../anki-connect/AnkiConnect";
import getIDFromPage from "../logseq/getIDFromPage";
import getNameFromPage from "../logseq/getNameFromPage";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {LogseqNamespaceHelper} from "../logseq/LogseqNamespaceHelper";
import {LogseqPropertiesHelper} from "../logseq/LogseqPropertiesHelper";
import {showSelectionModal} from "../ui";
import {getLogseqBlockPropSafe, handleAnkiError} from "../utils/utils";
import {Addon} from "./Addon";

export class PreviewInAnkiContextMenu extends Addon {
    static _instance: PreviewInAnkiContextMenu;

    public getName(): string {
        return "Preview Cards in Anki Context Menu";
    }

    public init(): void {
        if (this.isEnabled()) {
            logseq.Editor.registerBlockContextMenuItem(
                "Preview in Anki",
                this.previewBlockNotesInAnki
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

    private async previewPageNotesInAnki(arg: {page: string}) {
        try {
            const pageObj = await LogseqPropertiesHelper.getPage(arg.page); // Ideally, we should pass page.id but it is not passed
            const graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
            const modelName = `${graphName}Model`.replace(/\s/g, "_");
            await AnkiConnect.requestPermission();
            let query = "";
            if (
                pageObj &&
                (await LogseqAppInfoFetcher.checkCurrentIsDbGraph()) &&
                getLogseqBlockPropSafe(pageObj, "properties.tags", []).includes("Tag")
            ) {
                query = `"note:${modelName}" "tag:${getNameFromPage(pageObj)}"`;
            } else if (pageObj) {
                const namespacePages = await LogseqNamespaceHelper.getNamespaceDescendants(pageObj);
                let pagesToView = [pageObj];
                if (namespacePages.length > 0) {
                    const selection = await showSelectionModal(
                        [
                            {name: "Preview cards from this namespace in anki"},
                            {name: "Preview cards from this page in anki"}
                        ],
                        {message: "Select cards", enableKeySelect: true}
                    );
                    if (selection == null) return;
                    if (selection === 0) {
                        pagesToView = [...pagesToView, ...namespacePages];
                    }
                }
                const pageIds = pagesToView
                    .map((page) => getIDFromPage(page))
                    .filter((id) => id != null);
                query = `"note:${modelName}" ${pageIds.map((id) => `"Logseq Page Id:${id}"`).join(" OR ")}`;
            } else throw "Invalid page object passed to previewPageNotesInAnki";
            await AnkiConnect.guiBrowse(query);
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
