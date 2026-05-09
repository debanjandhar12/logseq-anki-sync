import type {LazyAnkiNoteManager} from "../../anki-connect/LazyAnkiNoteManager";
import type {Note} from "../../anki-notes/Note";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.SyncInternal);

import _ from "lodash";
import path from "path-browserify";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import type {ProgressNotification} from "../../ui";
import {NoteHashCalculator} from "../cache";
import {parseNote} from "../parsers/NoteParser";

export class CreateNotesTask {
    async execute(
        notes: Note[],
        modelName: string,
        graphName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{succeeded: Note[]; failed: {[key: string]: Error}}> {
        const failedCreated: {[key: string]: Error} = {};

        for (const note of notes) {
            try {
                await this.createNote(note, modelName, graphName, graphPath, ankiNoteManager);
            } catch (e) {
                logger.error("Failed to create note", e);
                failedCreated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const addResult = await ankiNoteManager.executeAddNotes();

        for (const successfulNote of addResult.successfulNotes) {
            const uuidtype = successfulNote["uuid-type"];
            const uuid = uuidtype.split("-").slice(0, -1).join("-");
            const type = uuidtype.split("-").slice(-1)[0];
            const note = _.find(notes, {uuid: uuid, type: type});
            if (note) {
                note.ankiId = successfulNote.ankiId;
            }
        }

        for (const failure of addResult.failedNotes) {
            logger.error("Failed to add note", failure.error);
            failedCreated[failure.identifier] = failure.error;
        }

        const secondAddResult = await ankiNoteManager.executeAddNotes();
        for (const failure of secondAddResult.failedNotes) {
            logger.error("Failed to add note (second attempt)", failure.error);
        }

        const succeeded = notes.filter((n) => !failedCreated[`${n.uuid}-${n.type}`]);
        return {succeeded, failed: failedCreated};
    }

    private async createNote(
        note: Note,
        modelName: string,
        graphName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager
    ): Promise<void> {
        const [html, assets, deck, breadcrumb, tags] = await parseNote(note, graphName);
        const dependencyHash = await NoteHashCalculator.getHash(note, [
            html,
            assets,
            deck,
            breadcrumb,
            tags
        ]);

        for (const asset of assets) {
            const name = path.basename(asset);
            const url = await WindowParentBridge.makeAssetUrl(asset);
            ankiNoteManager.storeAsset(name, url);
        }

        ankiNoteManager.addNote(
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
}
