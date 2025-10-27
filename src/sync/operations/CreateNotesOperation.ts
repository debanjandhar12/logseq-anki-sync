import { Note } from "../../anki-notes-generator/Note";
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";
import { ParsedNoteData } from "../types";
import { NoteHashCalculator } from "../cache";
import path from "path-browserify";
import _ from "lodash";

export class CreateNotesOperation {
    async execute(
        notes: Note[],
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: Note[], failed: { [key: string]: Error } }> {
        const failedCreated: { [key: string]: Error } = {};

        for (const note of notes) {
            try {
                await this.createNote(note, modelName, graphPath, ankiNoteManager, parseNote);
            } catch (e) {
                console.error(e);
                failedCreated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const addResult = await ankiNoteManager.executeAddNotes();
        
        for (const successfulNote of addResult.successfulNotes) {
            const uuidtype = successfulNote["uuid-type"];
            const uuid = uuidtype.split("-").slice(0, -1).join("-");
            const type = uuidtype.split("-").slice(-1)[0];
            const note = _.find(notes, { uuid: uuid, type: type });
            if (note) {
                note["ankiId"] = successfulNote["ankiId"];
            }
        }

        for (const failure of addResult.failedNotes) {
            console.error(failure.error);
            failedCreated[failure.identifier] = failure.error;
        }

        const secondAddResult = await ankiNoteManager.executeAddNotes();
        for (const failure of secondAddResult.failedNotes) {
            console.error(failure.error);
        }

        const succeeded = notes.filter(n => !failedCreated[`${n.uuid}-${n.type}`]);
        return { succeeded, failed: failedCreated };
    }

    private async createNote(
        note: Note,
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>
    ): Promise<void> {
        const [html, assets, deck, breadcrumb, tags, extra] = await parseNote(note);
        const dependencyHash = await NoteHashCalculator.getHash(note, [
            html,
            assets,
            deck,
            breadcrumb,
            tags,
            extra,
        ]);

        assets.forEach((asset) => {
            ankiNoteManager.storeAsset(
                path.basename(asset),
                path.join(graphPath, path.resolve(asset))
            );
        });

        ankiNoteManager.addNote(
            deck,
            modelName,
            {
                "uuid-type": `${note.uuid}-${note.type}`,
                uuid: note.uuid,
                Text: html,
                Extra: extra,
                Breadcrumb: breadcrumb,
                Config: JSON.stringify({
                    dependencyHash,
                    assets: [...assets],
                }),
            },
            tags
        );
    }
}
