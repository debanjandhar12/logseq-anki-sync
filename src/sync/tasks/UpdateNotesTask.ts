import path from "path-browserify";
import type {LazyAnkiNoteManager} from "../../anki-connect/LazyAnkiNoteManager";
import type {Note} from "../../anki-notes/Note";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import type {ProgressNotification} from "../../ui";
import {NoteHashCalculator} from "../cache";
import {parseNote} from "../parsers/NoteParser";

const logger = createLogger(LoggerCategory.SyncInternal);

export class UpdateNotesTask {
    async execute(
        notes: Note[],
        modelName: string,
        graphName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{succeeded: Note[]; failed: {[key: string]: Error}}> {
        const failedUpdated: {[key: string]: Error} = {};

        for (const note of notes) {
            try {
                await this.updateNote(note, modelName, graphName, graphPath, ankiNoteManager);
            } catch (e) {
                logger.error(e);
                failedUpdated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const updateResult = await ankiNoteManager.executeUpdateNotes();
        for (const failure of updateResult.failedNotes) {
            logger.error(failure.error);
            failedUpdated[failure.identifier] = failure.error;
        }

        const succeeded = notes.filter((n) => !failedUpdated[`${n.uuid}-${n.type}`]);
        return {succeeded, failed: failedUpdated};
    }

    private async updateNote(
        note: Note,
        modelName: string,
        graphName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager
    ): Promise<void> {
        const ankiId = note.getAnkiId();
        const ankiNodeInfo = ankiNoteManager.noteInfoMap.get(ankiId);

        const oldConfig = this.parseConfig(ankiNodeInfo.fields.Config.value);
        const [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags] = [
            ankiNodeInfo.fields.Text.value,
            oldConfig.assets,
            ankiNodeInfo.deck,
            ankiNodeInfo.fields.Breadcrumb.value,
            ankiNodeInfo.tags
        ];

        let dependencyHash = await NoteHashCalculator.getHash(note, [
            oldHtml,
            oldAssets,
            oldDeck,
            oldBreadcrumb,
            oldTags
        ]);

        const {skipOnDependencyHashMatch} = LogseqProxy.Settings.getPluginSettings();

        for (const asset of oldConfig.assets ?? []) {
            const name = path.basename(asset);
            if (
                skipOnDependencyHashMatch &&
                oldConfig.dependencyHash === dependencyHash &&
                ankiNoteManager.mediaInfo.has(name)
            )
                continue;
            const url = await WindowParentBridge.makeAssetUrl(asset);
            ankiNoteManager.storeAsset(name, url);
        }

        const [html, assets, deck, breadcrumb, tags] = await parseNote(note, graphName);
        dependencyHash = await NoteHashCalculator.getHash(note, [
            html,
            assets,
            deck,
            breadcrumb,
            tags
        ]);

        assets.forEach((asset) => {
            // Normalize asset path by removing leading ../ or ./ since assets are relative to graph root
            const normalizedAsset = asset.replace(/^(\.\.\/)+(\.\/)*|^(\.\/)+/, "");
            ankiNoteManager.storeAsset(path.basename(asset), path.join(graphPath, normalizedAsset));
        });

        logger.info(`dependencyHash mismatch for note with id ${note.uuid}-${note.type}`);

        ankiNoteManager.updateNote(
            ankiId,
            deck,
            modelName,
            {
                "uuid-type": `${note.uuid}-${note.type}`,
                "Logseq Block UUID": note.uuid,
                "Logseq Page Id": note.pageId.toString(),
                Text: html,
                Breadcrumb: breadcrumb,
                Config: JSON.stringify({
                    dependencyHash,
                    assets: [...assets]
                })
            },
            tags
        );
    }

    private parseConfig(configString: string): any {
        try {
            return JSON.parse(configString);
        } catch (_e) {
            return {};
        }
    }
}
