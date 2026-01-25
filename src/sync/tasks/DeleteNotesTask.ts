import { LazyAnkiNoteManager } from "../../anki-connect/LazyAnkiNoteManager";
import { ProgressNotification } from "../../ui";

export class DeleteNotesTask {
    async execute(
        noteIds: number[],
        ankiNoteManager: LazyAnkiNoteManager,
        progressNotification: ProgressNotification
    ): Promise<{ succeeded: number[], failed: { [key: string]: Error } }> {
        const failedDeleted: { [key: string]: Error } = {};

        for (const ankiId of noteIds) {
            ankiNoteManager.deleteNote(ankiId);
            progressNotification.increment();
        }

        const deleteResult = await ankiNoteManager.executeDeleteNotes();
        for (const failure of deleteResult.failedNotes) {
            console.error(failure.error);
            failedDeleted[failure.identifier] = failure.error;
        }

        const succeeded = noteIds.filter(id => !failedDeleted[id.toString()]);
        return { succeeded, failed: failedDeleted };
    }
}
