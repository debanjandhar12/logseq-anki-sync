/**
 * Type definitions for Anki Connect operations
 */

export interface AnkiNoteFields {
    'uuid-type': string;
    uuid: string;
    Text: string;
    Extra: string;
    Breadcrumb: string;
    Config: string;
}

export interface AnkiNoteFieldValue {
    value: string;
    order: number;
}

export interface AnkiNoteInfo {
    noteId: number;
    cards: number[];
    fields: {
        [K in keyof AnkiNoteFields]: AnkiNoteFieldValue;
    };
    tags: string[];
    deck: string;
}

export interface AnkiAction {
    action: string;
    params: Record<string, any>;
}

export interface AnkiActionResult {
    error?: Error | string;
    [key: string]: any;
}

export interface AnkiIdUuidPair {
    'uuid-type': string;
    ankiId: number;
}

export interface OperationFailure {
    identifier: string;
    error: Error;
}

export interface AddNotesResult {
    successfulNotes: AnkiIdUuidPair[];
    failedNotes: OperationFailure[];
}

export interface UpdateNotesResult {
    successfulNotes: string[]; // uuid-types
    failedNotes: OperationFailure[];
}

export interface DeleteNotesResult {
    successfulNotes: number[]; // anki IDs
    failedNotes: OperationFailure[];
}

export type OperationType = 'addNotes' | 'updateNotes' | 'deleteNotes' | 'storeAssets';
