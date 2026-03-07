import {Note} from "../anki-notes/Note";

/**
 * ====== Type definitions for sync operations ======
 */

/**
 * Represents parsed note data before conversion to Anki note fields.
 * This is the intermediate format returned by parseNote() and used in hash calculation.
 */
export type ParsedNoteData = [
    html: string,
    assets: Set<string>,
    deck: string,
    breadcrumb: string,
    tags: string[]
];

/**
 * Contains result info from syncing.
 */
export interface SyncResult {
    /** Notes that were created or attempted to be created */
    toCreateNotes: Note[];
    /** Notes that were updated or attempted to be updated */
    toUpdateNotes: Note[];
    /** Anki note IDs that were deleted or attempted to be deleted */
    toDeleteNotes: number[];
    /** Map of failed create operations: key is "uuid-type", value is the error */
    failedCreated: {[key: string]: Error};
    /** Map of failed update operations: key is "uuid-type", value is the error */
    failedUpdated: {[key: string]: Error};
    /** Map of failed delete operations: key is note ID, value is the error */
    failedDeleted: {[key: string]: Error};
}
