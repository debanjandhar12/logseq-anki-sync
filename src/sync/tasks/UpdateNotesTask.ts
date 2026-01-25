import { Note } from "../../anki-notes/Note";
import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";
import { ParsedNoteData } from "../types";
import { NoteHashCalculator } from "../cache";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import path from "path-browserify";

export class UpdateNotesTask {
    async execute(
        notes: Note[],
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: Note[], failed: { [key: string]: Error } }> {
        const failedUpdated: { [key: string]: Error } = {};

        for (const note of notes) {
            try {
                await this.updateNote(note, modelName, graphPath, ankiNoteManager, parseNote);
            } catch (e) {
                console.error(e);
                failedUpdated[`${note.uuid}-${note.type}`] = e;
            }
            progressNotification.increment();
        }

        const updateResult = await ankiNoteManager.executeUpdateNotes();
        for (const failure of updateResult.failedNotes) {
            console.error(failure.error);
            failedUpdated[failure.identifier] = failure.error;
        }

        const succeeded = notes.filter(n => !failedUpdated[`${n.uuid}-${n.type}`]);
        return { succeeded, failed: failedUpdated };
    }

    private async updateNote(
        note: Note,
        modelName: string,
        graphPath: string,
        ankiNoteManager: LazyAnkiNoteManager,
        parseNote: (note: Note) => Promise<ParsedNoteData>
    ): Promise<void> {
        const ankiId = note.getAnkiId();
        const ankiNodeInfo = ankiNoteManager.noteInfoMap.get(ankiId);
        
        const oldConfig = this.parseConfig(ankiNodeInfo.fields.Config.value);
        const [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags, oldExtra] = [
            ankiNodeInfo.fields.Text.value,
            oldConfig.assets,
            ankiNodeInfo.deck,
            ankiNodeInfo.fields.Breadcrumb.value,
            ankiNodeInfo.tags,
            ankiNodeInfo.fields.Extra.value,
        ];

        let dependencyHash = await NoteHashCalculator.getHash(note, [
            oldHtml,
            oldAssets,
            oldDeck,
            oldBreadcrumb,
            oldTags,
            oldExtra,
        ]);

        const { skipOnDependencyHashMatch } = LogseqProxy.Settings.getPluginSettings();
        
        if (skipOnDependencyHashMatch && oldConfig.dependencyHash === dependencyHash) {
            oldConfig.assets?.forEach((asset) => {
                if (ankiNoteManager.mediaInfo.has(path.basename(asset))) return;
                ankiNoteManager.storeAsset(
                    path.basename(asset),
                    path.join(graphPath, path.resolve(asset))
                );
            });
            return;
        }

        const [html, assets, deck, breadcrumb, tags, extra] = await parseNote(note);
        dependencyHash = await NoteHashCalculator.getHash(note, [
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

        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug.includes("syncLogseqToAnki.ts")) {
            console.log(`dependencyHash mismatch for note with id ${note.uuid}-${note.type}`);
        }

        ankiNoteManager.updateNote(
            ankiId,
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

    private parseConfig(configString: string): any {
        try {
            return JSON.parse(configString);
        } catch (e) {
            return {};
        }
    }
}
